create or replace function public.boost_my_item(p_item_id bigint)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare expiry timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.items
    where id = p_item_id and owner_id = auth.uid() and is_available and not is_rented
  ) or not exists (
    select 1 from public.premium_memberships
    where user_id = auth.uid() and active_until > now()
  ) then
    raise exception 'Boost hanya untuk barang tersedia milik anggota Premium';
  end if;
  if exists (select 1 from public.item_boosts where item_id = p_item_id and boosted_until > now()) then
    raise exception 'Boost barang ini masih aktif';
  end if;
  expiry := now() + interval '7 days';
  insert into public.item_boosts (item_id, boosted_until) values (p_item_id, expiry)
  on conflict (item_id) do update set boosted_until = excluded.boosted_until, updated_at = now();
  return expiry;
end;
$$;
