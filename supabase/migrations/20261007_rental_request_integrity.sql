create or replace function public.validate_rental_request()
returns trigger language plpgsql set search_path = public as $$
declare
  item_price integer;
begin
  if new.status <> 'Menunggu persetujuan'
    or new.handoff_renter_confirmed_at is not null
    or new.handoff_owner_confirmed_at is not null
    or new.return_renter_confirmed_at is not null
    or new.return_owner_confirmed_at is not null then
    raise exception 'Status awal permintaan sewa tidak valid';
  end if;

  if new.start_date < current_date
    or new.days not between 1 and 7
    or new.end_date <> new.start_date + new.days then
    raise exception 'Tanggal atau durasi sewa tidak valid';
  end if;

  select price_per_day into item_price from public.items where id = new.item_id;
  if item_price is null or new.total_price::bigint <> item_price::bigint * new.days then
    raise exception 'Total sewa tidak sesuai harga barang';
  end if;

  return new;
end;
$$;

drop trigger if exists rentals_validate_request on public.rentals;
create trigger rentals_validate_request
before insert on public.rentals
for each row execute function public.validate_rental_request();

revoke all on public.rentals from public, anon, authenticated;
grant select, insert on public.rentals to authenticated;
grant usage, select on sequence public.rentals_id_seq to authenticated;
