create or replace function public.cancel_rental(p_rental_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  cancelled_item_id bigint;
  item_owner uuid;
  item_name text;
begin
  update public.rentals
  set status = 'Dibatalkan'
  where id = p_rental_id
    and renter_id = auth.uid()
    and status = 'Menunggu persetujuan'
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  returning item_id into cancelled_item_id;

  if cancelled_item_id is null then
    raise exception 'Permintaan tidak ditemukan atau sudah diproses';
  end if;

  select owner_id, title into item_owner, item_name
  from public.items where id = cancelled_item_id;
  if item_owner is not null then
    insert into public.notifications (user_id, rental_id, kind, title, message, href)
    values (item_owner, p_rental_id, 'owner_rental_cancelled', 'Permintaan sewa dibatalkan',
      'Penyewa membatalkan permintaan untuk "' || coalesce(item_name, 'Barang sewaan') || '".', '/lend')
    on conflict (rental_id, kind) do nothing;
  end if;
end;
$$;

revoke all on function public.cancel_rental(bigint) from public, anon;
grant execute on function public.cancel_rental(bigint) to authenticated;
