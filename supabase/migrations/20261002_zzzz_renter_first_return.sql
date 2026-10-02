create or replace function public.require_renter_return_first()
returns trigger language plpgsql as $$
begin
  if old.return_owner_confirmed_at is null
    and new.return_owner_confirmed_at is not null
    and old.return_renter_confirmed_at is null then
    raise exception 'Penyewa harus mengonfirmasi pengembalian terlebih dahulu';
  end if;
  return new;
end;
$$;

drop trigger if exists rentals_require_renter_return_first on public.rentals;
create trigger rentals_require_renter_return_first
before update of return_owner_confirmed_at on public.rentals
for each row execute function public.require_renter_return_first();
