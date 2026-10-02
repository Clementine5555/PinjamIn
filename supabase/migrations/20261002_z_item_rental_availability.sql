alter table public.items add column if not exists is_rented boolean not null default false;

create or replace function public.sync_item_rented()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  changed_item_id bigint;
begin
  if tg_op = 'DELETE' then
    changed_item_id := old.item_id;
  else
    changed_item_id := new.item_id;
  end if;

  update public.items i
  set is_rented = exists (
    select 1 from public.rentals r
    where r.item_id = changed_item_id and r.status = 'Sedang disewa'
  )
  where i.id = changed_item_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists rentals_sync_item_rented on public.rentals;
create trigger rentals_sync_item_rented
after update of status or delete on public.rentals
for each row execute function public.sync_item_rented();

update public.items i
set is_rented = exists (
  select 1 from public.rentals r
  where r.item_id = i.id and r.status = 'Sedang disewa'
);

drop policy if exists "Pengguna membuat transaksi sendiri" on public.rentals;
create policy "Pengguna membuat transaksi sendiri" on public.rentals for insert to authenticated
with check (
  auth.uid() = renter_id
  and status = 'Menunggu persetujuan'
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and exists (
    select 1 from public.items i
    where i.id = item_id and i.owner_id is distinct from auth.uid()
      and i.is_available and not i.is_rented
  )
);
