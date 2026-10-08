create or replace function public.require_paid_handoff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'Disetujui'
    and (
      new.handoff_renter_confirmed_at is distinct from old.handoff_renter_confirmed_at
      or new.handoff_owner_confirmed_at is distinct from old.handoff_owner_confirmed_at
      or new.status = 'Sedang disewa'
    )
    and not exists (
      select 1 from public.rental_payments p
      where p.rental_id = new.id and p.status = 'Dibayar' and p.amount = new.total_price
    ) then
    raise exception 'Selesaikan pembayaran sebelum serah terima barang';
  end if;
  return new;
end;
$$;

drop trigger if exists rentals_require_paid_handoff on public.rentals;
create trigger rentals_require_paid_handoff
before update of status, handoff_renter_confirmed_at, handoff_owner_confirmed_at on public.rentals
for each row execute function public.require_paid_handoff();

create or replace function public.admin_payment_summary()
returns table(paid_count bigint, paid_amount bigint, pending_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.jwt()->'app_metadata'->>'seru_role' is distinct from 'admin' then
    raise exception 'Akses pengelola diperlukan';
  end if;
  return query
    select
      count(*) filter (where p.status = 'Dibayar'),
      coalesce(sum(p.amount) filter (where p.status = 'Dibayar'), 0)::bigint,
      count(*) filter (where p.status in ('Mempersiapkan', 'Menunggu'))
    from public.rental_payments p;
end;
$$;

revoke all on function public.admin_payment_summary() from public, anon;
grant execute on function public.admin_payment_summary() to authenticated;
