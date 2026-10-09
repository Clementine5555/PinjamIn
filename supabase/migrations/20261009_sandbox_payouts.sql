create table if not exists public.rental_payouts (
  rental_id bigint primary key references public.rentals(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  gross_amount integer not null check (gross_amount > 0),
  fee_bps integer not null check (fee_bps between 0 and 10000),
  platform_fee integer not null check (platform_fee >= 0),
  owner_amount integer not null check (owner_amount >= 0),
  status text not null default 'Menunggu simulasi'
    check (status in ('Menunggu simulasi', 'Tercatat simulasi', 'Perlu peninjauan')),
  created_at timestamptz not null default now(),
  marked_at timestamptz,
  marked_by uuid references auth.users(id),
  constraint rental_payouts_amounts_match check (gross_amount = platform_fee + owner_amount)
);

create index if not exists rental_payouts_owner_idx on public.rental_payouts(owner_id, created_at desc);
alter table public.rental_payouts enable row level security;
revoke all on public.rental_payouts from public, anon, authenticated;
grant select on public.rental_payouts to authenticated;

drop policy if exists "Pemilik dan admin melihat simulasi pencairan" on public.rental_payouts;
create policy "Pemilik dan admin melihat simulasi pencairan" on public.rental_payouts
for select to authenticated using (
  owner_id = auth.uid() or auth.jwt()->'app_metadata'->>'seru_role' = 'admin'
);

create or replace function public.create_rental_payout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  payout_owner uuid;
  payout_gross integer;
  payout_fee integer;
begin
  if new.status <> 'Selesai' or old.status = 'Selesai' then
    return new;
  end if;
  select i.owner_id, p.amount into payout_owner, payout_gross
  from public.items i
  join public.rental_payments p on p.rental_id = new.id
  where i.id = new.item_id and p.status = 'Dibayar' and p.amount = new.total_price;
  if payout_owner is null then
    return new;
  end if;
  payout_fee := ((payout_gross::bigint * 1000) / 10000)::integer;
  insert into public.rental_payouts
    (rental_id, owner_id, gross_amount, fee_bps, platform_fee, owner_amount, status)
  values (new.id, payout_owner, payout_gross, 1000, payout_fee, payout_gross - payout_fee,
    case when exists (select 1 from public.rental_reports where rental_id = new.id and status <> 'Selesai')
      then 'Perlu peninjauan' else 'Menunggu simulasi' end)
  on conflict (rental_id) do nothing;
  return new;
end;
$$;

drop trigger if exists rentals_create_sandbox_payout on public.rentals;
create trigger rentals_create_sandbox_payout
after update of status on public.rentals
for each row execute function public.create_rental_payout();

insert into public.rental_payouts
  (rental_id, owner_id, gross_amount, fee_bps, platform_fee, owner_amount, status)
select r.id, i.owner_id, p.amount, 1000,
  ((p.amount::bigint * 1000) / 10000)::integer,
  p.amount - ((p.amount::bigint * 1000) / 10000)::integer,
  case when exists (select 1 from public.rental_reports report where report.rental_id = r.id and report.status <> 'Selesai')
    then 'Perlu peninjauan' else 'Menunggu simulasi' end
from public.rentals r
join public.items i on i.id = r.item_id
join public.rental_payments p on p.rental_id = r.id
where r.status = 'Selesai' and p.status = 'Dibayar' and p.amount = r.total_price
  and i.owner_id is not null
on conflict (rental_id) do nothing;

create or replace function public.flag_sandbox_payout_after_refund()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Dikembalikan' and old.status is distinct from new.status then
    update public.rental_payouts set status = 'Perlu peninjauan'
    where rental_id = new.rental_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_flag_sandbox_payout_refund on public.rental_payments;
create trigger payments_flag_sandbox_payout_refund
after update of status on public.rental_payments
for each row execute function public.flag_sandbox_payout_after_refund();

create or replace function public.flag_sandbox_payout_after_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'Selesai' then
    update public.rental_payouts set status = 'Perlu peninjauan'
    where rental_id = new.rental_id;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_flag_sandbox_payout on public.rental_reports;
create trigger reports_flag_sandbox_payout
after insert or update of status on public.rental_reports
for each row execute function public.flag_sandbox_payout_after_report();

create or replace function public.mark_sandbox_payout(p_rental_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  payout_row public.rental_payouts%rowtype;
begin
  if auth.uid() is null or auth.jwt()->'app_metadata'->>'seru_role' is distinct from 'admin' then
    raise exception 'Akses pengelola diperlukan';
  end if;
  select * into payout_row from public.rental_payouts where rental_id = p_rental_id for update;
  if not found then
    raise exception 'Simulasi pencairan tidak ditemukan';
  end if;
  if payout_row.status = 'Tercatat simulasi' then
    return payout_row.status;
  end if;
  if payout_row.status not in ('Menunggu simulasi', 'Perlu peninjauan')
    or not exists (select 1 from public.rentals where id = p_rental_id and status = 'Selesai')
    or not exists (select 1 from public.rental_payments where rental_id = p_rental_id and status = 'Dibayar')
    or exists (select 1 from public.rental_reports where rental_id = p_rental_id and status <> 'Selesai') then
    raise exception 'Transaksi, pembayaran, atau laporan belum siap untuk simulasi pencairan';
  end if;
  update public.rental_payouts set
    status = 'Tercatat simulasi', marked_at = now(), marked_by = auth.uid()
  where rental_id = p_rental_id;
  return 'Tercatat simulasi';
end;
$$;

revoke all on function public.mark_sandbox_payout(bigint) from public, anon;
grant execute on function public.mark_sandbox_payout(bigint) to authenticated;
