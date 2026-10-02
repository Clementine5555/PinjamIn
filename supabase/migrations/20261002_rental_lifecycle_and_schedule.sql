alter table public.rentals
  add column if not exists handoff_renter_confirmed_at timestamptz,
  add column if not exists handoff_owner_confirmed_at timestamptz,
  add column if not exists return_renter_confirmed_at timestamptz,
  add column if not exists return_owner_confirmed_at timestamptz;

create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rentals_no_overlapping_approved_dates' and conrelid = 'public.rentals'::regclass) then
    alter table public.rentals add constraint rentals_no_overlapping_approved_dates
      exclude using gist (item_id with =, daterange(start_date, end_date, '[]') with &&)
      where (status in ('Disetujui', 'Sedang disewa', 'Selesai'));
  end if;
end;
$$;

drop policy if exists "Pengguna membuat transaksi sendiri" on public.rentals;
create policy "Pengguna membuat transaksi sendiri" on public.rentals for insert to authenticated
with check (
  auth.uid() = renter_id
  and status = 'Menunggu persetujuan'
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and not exists (select 1 from public.items where items.id = item_id and items.owner_id = auth.uid())
);

create or replace function public.review_rental(p_rental_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  rental_item_id bigint;
  reviewed_id bigint;
begin
  if p_status not in ('Disetujui', 'Ditolak') then
    raise exception 'Status tidak valid';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Akun terdaftar diperlukan';
  end if;

  select r.item_id into rental_item_id
  from public.rentals r join public.items i on i.id = r.item_id
  where r.id = p_rental_id and i.owner_id = auth.uid() and r.status = 'Menunggu persetujuan';
  if rental_item_id is null then
    raise exception 'Permintaan tidak ditemukan atau sudah diproses';
  end if;

  perform 1 from public.items where id = rental_item_id for update;

  if p_status = 'Disetujui' and exists (
    select 1 from public.rentals requested
    join public.rentals booked on booked.item_id = requested.item_id
    where requested.id = p_rental_id and booked.id <> requested.id
      and booked.status in ('Disetujui', 'Sedang disewa', 'Selesai')
      and daterange(booked.start_date, booked.end_date, '[]') && daterange(requested.start_date, requested.end_date, '[]')
  ) then
    raise exception 'Tanggal sewa bentrok dengan permintaan yang sudah disetujui';
  end if;

  update public.rentals set status = p_status
  where id = p_rental_id and status = 'Menunggu persetujuan'
  returning id into reviewed_id;
  if reviewed_id is null then
    raise exception 'Permintaan tidak ditemukan atau sudah diproses';
  end if;
end;
$$;

revoke all on function public.review_rental(bigint, text) from public, anon;
grant execute on function public.review_rental(bigint, text) to authenticated;

create or replace function public.confirm_rental_stage(p_rental_id bigint, p_stage text)
returns void language plpgsql security definer set search_path = public as $$
declare
  rental_row public.rentals%rowtype;
  item_owner uuid;
  item_name text;
  is_renter boolean;
  next_status text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Akun terdaftar diperlukan';
  end if;
  if p_stage not in ('handoff', 'return') then
    raise exception 'Tahap konfirmasi tidak valid';
  end if;

  select * into rental_row from public.rentals where id = p_rental_id for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  select owner_id, title into item_owner, item_name from public.items where id = rental_row.item_id;
  if auth.uid() <> rental_row.renter_id and auth.uid() is distinct from item_owner then
    raise exception 'Kamu bukan peserta transaksi ini';
  end if;
  is_renter := auth.uid() = rental_row.renter_id;

  if p_stage = 'handoff' then
    if rental_row.status <> 'Disetujui' then
      raise exception 'Serah terima hanya dapat dikonfirmasi setelah disetujui';
    end if;
    if (is_renter and rental_row.handoff_renter_confirmed_at is not null)
      or (not is_renter and rental_row.handoff_owner_confirmed_at is not null) then
      return;
    end if;
    update public.rentals set
      handoff_renter_confirmed_at = case when is_renter then now() else handoff_renter_confirmed_at end,
      handoff_owner_confirmed_at = case when not is_renter then now() else handoff_owner_confirmed_at end
    where id = p_rental_id returning * into rental_row;
    if rental_row.handoff_renter_confirmed_at is not null and rental_row.handoff_owner_confirmed_at is not null then
      next_status := 'Sedang disewa';
    end if;
  else
    if rental_row.status <> 'Sedang disewa' then
      raise exception 'Pengembalian hanya dapat dikonfirmasi saat barang sedang disewa';
    end if;
    if (is_renter and rental_row.return_renter_confirmed_at is not null)
      or (not is_renter and rental_row.return_owner_confirmed_at is not null) then
      return;
    end if;
    update public.rentals set
      return_renter_confirmed_at = case when is_renter then now() else return_renter_confirmed_at end,
      return_owner_confirmed_at = case when not is_renter then now() else return_owner_confirmed_at end
    where id = p_rental_id returning * into rental_row;
    if rental_row.return_renter_confirmed_at is not null and rental_row.return_owner_confirmed_at is not null then
      next_status := 'Selesai';
    end if;
  end if;

  if next_status is null then
    if not is_renter or item_owner is not null then
      insert into public.notifications (user_id, rental_id, kind, title, message, href)
      values (
        case when is_renter then item_owner else rental_row.renter_id end,
        p_rental_id,
        p_stage || ':' || case when is_renter then 'renter' else 'owner' end,
        case when p_stage = 'handoff' then 'Konfirmasi serah terima' else 'Konfirmasi pengembalian' end,
        'Konfirmasi kamu diperlukan untuk "' || coalesce(item_name, 'Barang sewaan') || '".',
        case when is_renter then '/lend' else '/transactions' end
      ) on conflict (rental_id, kind) do nothing;
    end if;
  else
    update public.rentals set status = next_status where id = p_rental_id;
    if item_owner is not null then
      insert into public.notifications (user_id, rental_id, kind, title, message, href)
      values (item_owner, p_rental_id, 'owner_status:' || next_status, 'Status sewa diperbarui',
        'Status sewa "' || coalesce(item_name, 'Barang sewaan') || '" berubah menjadi ' || next_status || '.', '/lend')
      on conflict (rental_id, kind) do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.confirm_rental_stage(bigint, text) from public, anon;
grant execute on function public.confirm_rental_stage(bigint, text) to authenticated;
