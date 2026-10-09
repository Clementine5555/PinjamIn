alter table public.rental_cancellations
  add column if not exists requested_by text not null default 'renter'
    check (requested_by in ('renter', 'owner'));

create or replace function public.cancel_owner_rental(p_rental_id bigint, p_reason text)
returns text language plpgsql security definer set search_path = public as $$
declare
  rental_row public.rentals%rowtype;
  owner_id uuid;
  has_payment boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or auth.jwt()->'app_metadata'->>'seru_role' = 'admin' then
    raise exception 'Akun pemilik diperlukan';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Alasan pembatalan harus 5 sampai 500 karakter';
  end if;

  select * into rental_row from public.rentals where id = p_rental_id for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  select i.owner_id into owner_id from public.items i where i.id = rental_row.item_id;
  if owner_id is distinct from auth.uid() then
    raise exception 'Hanya pemilik barang yang dapat membatalkan transaksi';
  end if;
  if rental_row.status <> 'Disetujui'
    or rental_row.handoff_renter_confirmed_at is not null
    or rental_row.handoff_owner_confirmed_at is not null then
    raise exception 'Pembatalan hanya bisa dilakukan sebelum serah terima';
  end if;
  if exists (select 1 from public.rental_cancellations where rental_id = p_rental_id) then
    raise exception 'Pengajuan pembatalan sudah ada untuk transaksi ini';
  end if;

  select exists (select 1 from public.rental_payments where rental_id = p_rental_id) into has_payment;
  if not has_payment then
    update public.rentals set status = 'Dibatalkan' where id = p_rental_id;
    insert into public.notifications (user_id, rental_id, kind, title, message, href)
    values (rental_row.renter_id, p_rental_id, 'renter_owner_cancelled', 'Sewa dibatalkan pemilik',
      'Pemilik barang membatalkan pesanan sebelum pembayaran. Lihat status di Transaksi.', '/transactions')
    on conflict (rental_id, kind) do nothing;
    return 'Dibatalkan';
  end if;

  insert into public.rental_cancellations (rental_id, renter_id, reason, requested_by)
  values (p_rental_id, rental_row.renter_id, trim(p_reason), 'owner');
  insert into public.notifications (user_id, rental_id, kind, title, message, href)
  values (rental_row.renter_id, p_rental_id, 'renter_owner_cancellation_requested', 'Pemilik mengajukan pembatalan',
    'Pemilik barang mengajukan pembatalan. Pembayaran sedang ditinjau pengelola.', '/transactions')
  on conflict (rental_id, kind) do nothing;
  return 'Menunggu';
end;
$$;

revoke all on function public.cancel_owner_rental(bigint, text) from public, anon;
grant execute on function public.cancel_owner_rental(bigint, text) to authenticated;
