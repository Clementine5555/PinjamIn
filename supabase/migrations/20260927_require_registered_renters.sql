drop policy if exists "Pengguna membuat transaksi sendiri" on public.rentals;

create policy "Pengguna membuat transaksi sendiri"
on public.rentals for insert to authenticated
with check (
  auth.uid() = renter_id
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
);
