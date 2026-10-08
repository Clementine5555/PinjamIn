drop policy if exists "Pemilik menambahkan barang" on public.items;
create policy "Pemilik menambahkan barang" on public.items for insert to authenticated
with check (
  owner_id = auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
);

drop policy if exists "Pemilik mengunggah foto barang" on storage.objects;
create policy "Pemilik mengunggah foto barang" on storage.objects for insert to authenticated
with check (
  bucket_id = 'item-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
);

drop policy if exists "Pengguna membuat transaksi sendiri" on public.rentals;
create policy "Pengguna membuat transaksi sendiri" on public.rentals for insert to authenticated
with check (
  auth.uid() = renter_id
  and status = 'Menunggu persetujuan'
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
  and exists (
    select 1 from public.items i
    where i.id = item_id and i.owner_id is distinct from auth.uid()
      and i.is_available and not i.is_rented
  )
);
