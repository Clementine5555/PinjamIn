revoke update on public.items from public, anon, authenticated;
grant update (title, description, price_per_day, image_url, category, location, is_available) on public.items to authenticated;

drop policy if exists "Pemilik memperbarui barang" on public.items;
create policy "Pemilik memperbarui barang" on public.items for update to authenticated
using (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false)
with check (owner_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

drop policy if exists "Pemilik menghapus foto barang" on storage.objects;
create policy "Pemilik menghapus foto barang" on storage.objects for delete to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.check_listing_before_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Disetujui' and old.status = 'Menunggu persetujuan'
    and not exists (
      select 1 from public.items i
      where i.id = new.item_id and i.is_available and not i.is_rented
    ) then
    raise exception 'Barang tidak tersedia untuk disetujui';
  end if;
  return new;
end;
$$;

drop trigger if exists rentals_check_listing_before_approval on public.rentals;
create trigger rentals_check_listing_before_approval
before update of status on public.rentals
for each row execute function public.check_listing_before_approval();
