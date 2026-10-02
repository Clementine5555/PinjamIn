alter table public.rentals
  drop constraint if exists rentals_no_overlapping_approved_dates;

alter table public.rentals
  add constraint rentals_no_overlapping_approved_dates
  exclude using gist (item_id with =, daterange(start_date, end_date, '[]') with &&)
  where (status in ('Disetujui', 'Sedang disewa'));

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
      and booked.status in ('Disetujui', 'Sedang disewa')
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
