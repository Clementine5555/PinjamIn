create table if not exists public.rental_cancellations (
  rental_id bigint primary key references public.rentals(id) on delete cascade,
  renter_id uuid not null references auth.users(id),
  reason text not null check (char_length(reason) between 5 and 500),
  status text not null default 'Menunggu'
    check (status in ('Menunggu', 'Diproses', 'Perlu manual', 'Ditolak', 'Selesai')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.rental_cancellations enable row level security;
revoke all on public.rental_cancellations from public, anon, authenticated;
grant select on public.rental_cancellations to authenticated;

drop policy if exists "Peserta dan admin melihat pembatalan" on public.rental_cancellations;
create policy "Peserta dan admin melihat pembatalan" on public.rental_cancellations
for select to authenticated using (
  renter_id = auth.uid()
  or auth.jwt()->'app_metadata'->>'seru_role' = 'admin'
  or exists (
    select 1 from public.rentals r join public.items i on i.id = r.item_id
    where r.id = rental_id and i.owner_id = auth.uid()
  )
);

create or replace function public.request_rental_cancellation(p_rental_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  rental_row public.rentals%rowtype;
  owner_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or auth.jwt()->'app_metadata'->>'seru_role' = 'admin' then
    raise exception 'Akun penyewa diperlukan';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Alasan pembatalan harus 5 sampai 500 karakter';
  end if;
  select * into rental_row from public.rentals where id = p_rental_id for update;
  if not found or rental_row.renter_id <> auth.uid() then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  if rental_row.status <> 'Disetujui'
    or rental_row.handoff_renter_confirmed_at is not null
    or rental_row.handoff_owner_confirmed_at is not null then
    raise exception 'Pembatalan hanya bisa diajukan sebelum serah terima';
  end if;
  insert into public.rental_cancellations (rental_id, renter_id, reason)
  values (p_rental_id, auth.uid(), trim(p_reason));
  select i.owner_id into owner_id from public.items i where i.id = rental_row.item_id;
  if owner_id is not null then
    insert into public.notifications (user_id, rental_id, kind, title, message, href)
    values (owner_id, p_rental_id, 'owner_cancellation_requested', 'Pembatalan diajukan',
      'Penyewa mengajukan pembatalan sebelum serah terima.', '/lend/requests')
    on conflict (rental_id, kind) do nothing;
  end if;
end;
$$;

revoke all on function public.request_rental_cancellation(bigint, text) from public, anon;
grant execute on function public.request_rental_cancellation(bigint, text) to authenticated;

create or replace function public.block_handoff_for_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'Disetujui'
    and (
      new.handoff_renter_confirmed_at is distinct from old.handoff_renter_confirmed_at
      or new.handoff_owner_confirmed_at is distinct from old.handoff_owner_confirmed_at
      or new.status = 'Sedang disewa'
    )
    and exists (
      select 1 from public.rental_cancellations c
      where c.rental_id = new.id and c.status in ('Menunggu', 'Diproses', 'Perlu manual')
    ) then
    raise exception 'Pembatalan sedang ditinjau; serah terima ditunda';
  end if;
  return new;
end;
$$;

drop trigger if exists rentals_block_handoff_for_cancellation on public.rentals;
create trigger rentals_block_handoff_for_cancellation
before update of status, handoff_renter_confirmed_at, handoff_owner_confirmed_at on public.rentals
for each row execute function public.block_handoff_for_cancellation();

create or replace function public.block_payment_for_cancellation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rental_status text;
begin
  select r.status into rental_status from public.rentals r where r.id = new.rental_id for update;
  if rental_status is distinct from 'Disetujui' or exists (
      select 1 from public.rental_cancellations c
      where c.rental_id = new.rental_id and c.status in ('Menunggu', 'Diproses', 'Perlu manual')
    ) then
    raise exception 'Transaksi tidak dapat dibayar saat pembatalan aktif';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_block_active_cancellation on public.rental_payments;
create trigger payments_block_active_cancellation
before insert on public.rental_payments
for each row execute function public.block_payment_for_cancellation();

create or replace function public.finish_refunded_rental()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Dikembalikan' and old.status is distinct from new.status then
    update public.rentals set status = 'Dibatalkan'
    where id = new.rental_id and status = 'Disetujui'
      and handoff_renter_confirmed_at is null and handoff_owner_confirmed_at is null;
    update public.rental_cancellations set
      status = 'Selesai', resolution_note = 'Refund tercatat di Midtrans sandbox.', resolved_at = now()
    where rental_id = new.rental_id and status in ('Menunggu', 'Diproses', 'Perlu manual')
      and exists (select 1 from public.rentals r where r.id = new.rental_id and r.status = 'Dibatalkan');
  end if;
  return new;
end;
$$;

drop trigger if exists payments_finish_refunded_rental on public.rental_payments;
create trigger payments_finish_refunded_rental
after update of status on public.rental_payments
for each row execute function public.finish_refunded_rental();
