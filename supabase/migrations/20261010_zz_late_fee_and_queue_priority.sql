drop policy if exists "Pengguna masuk antrean" on public.item_waitlist;
create policy "Pengguna masuk antrean" on public.item_waitlist for insert to authenticated
with check (
  user_id = auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
  and exists (select 1 from public.items i
    where i.id = item_id and i.owner_id is distinct from auth.uid() and i.is_rented)
);

create or replace function public.advance_item_waitlist(p_item_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  listing public.items%rowtype;
  next_user uuid;
  active_user uuid;
begin
  select * into listing from public.items where id = p_item_id for update;
  if not found or not listing.is_available or listing.is_rented then return; end if;
  if exists (select 1 from public.rentals r
    where r.item_id = p_item_id and r.status = 'Disetujui') then return; end if;

  select w.user_id into active_user from public.item_waitlist w
  where w.item_id = p_item_id and w.notified_at is not null
    and (w.priority_until > now() or (w.claimed_rental_id is not null and exists (
      select 1 from public.rentals r where r.id = w.claimed_rental_id and r.status = 'Menunggu persetujuan'
    )))
  order by w.created_at, w.user_id limit 1;
  if active_user is not null then return; end if;

  select w.user_id into next_user from public.item_waitlist w
  where w.item_id = p_item_id and w.notified_at is null
  order by case when public.owner_has_premium(w.user_id) then 0 else 1 end,
    w.created_at, w.user_id limit 1;
  if next_user is null then return; end if;

  update public.item_waitlist
  set notified_at = now(), priority_until = now() + interval '24 hours'
  where item_id = p_item_id and user_id = next_user;
  insert into public.notifications (user_id, kind, title, message, href)
  values (next_user, 'queue_priority:' || p_item_id || ':' || extract(epoch from now())::bigint,
    'Giliranmu mengajukan sewa', listing.title || ' tersedia. Kamu punya giliran 24 jam untuk mengajukan sewa.',
    '/items/' || p_item_id);
end;
$$;

create or replace function public.item_waitlist_state(p_item_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  my_row public.item_waitlist%rowtype;
  active_row public.item_waitlist%rowtype;
  my_position integer;
  my_premium boolean;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Akun terdaftar diperlukan';
  end if;
  perform public.advance_item_waitlist(p_item_id);
  select * into my_row from public.item_waitlist
    where item_id = p_item_id and user_id = auth.uid();
  select w.* into active_row from public.item_waitlist w
  where w.item_id = p_item_id and w.notified_at is not null
    and (w.priority_until > now() or (w.claimed_rental_id is not null and exists (
      select 1 from public.rentals r where r.id = w.claimed_rental_id and r.status = 'Menunggu persetujuan'
    )))
  order by w.created_at, w.user_id limit 1;
  if my_row.user_id is not null and my_row.notified_at is null then
    my_premium := public.owner_has_premium(auth.uid());
    select count(*)::integer + 1 into my_position from public.item_waitlist w
    where w.item_id = p_item_id and w.notified_at is null
      and (public.owner_has_premium(w.user_id) and not my_premium
        or public.owner_has_premium(w.user_id) = my_premium
          and (w.created_at, w.user_id) < (my_row.created_at, my_row.user_id));
  end if;
  return jsonb_build_object(
    'queued', my_row.user_id is not null and my_row.notified_at is null,
    'position', my_position,
    'my_turn', active_row.user_id = auth.uid(),
    'priority_until', case when active_row.user_id = auth.uid() then active_row.priority_until else null end,
    'reserved', active_row.user_id is not null and active_row.user_id <> auth.uid()
  );
end;
$$;

create or replace function public.guard_waitlist_rental_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare active_row public.item_waitlist%rowtype;
begin
  perform public.advance_item_waitlist(new.item_id);
  select w.* into active_row from public.item_waitlist w
  where w.item_id = new.item_id and w.notified_at is not null
    and (w.priority_until > now() or (w.claimed_rental_id is not null and exists (
      select 1 from public.rentals r where r.id = w.claimed_rental_id and r.status = 'Menunggu persetujuan'
    )))
  order by w.created_at, w.user_id limit 1;
  if active_row.user_id is not null
    and (active_row.user_id <> new.renter_id or active_row.claimed_rental_id is not null) then
    raise exception 'Barang sedang diprioritaskan untuk pengguna dalam antrean';
  end if;
  return new;
end;
$$;

create or replace function public.check_listing_before_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Disetujui' and old.status = 'Menunggu persetujuan' then
    if not exists (select 1 from public.items i
      where i.id = new.item_id and i.is_available and not i.is_rented) then
      raise exception 'Barang tidak tersedia untuk disetujui';
    end if;
    perform public.advance_item_waitlist(new.item_id);
    if exists (select 1 from public.item_waitlist w
      where w.item_id = new.item_id and w.notified_at is not null
        and (w.priority_until > now() or w.claimed_rental_id is not null)
        and w.claimed_rental_id is distinct from new.id) then
      raise exception 'Antrean masih memiliki giliran prioritas';
    end if;
  end if;
  return new;
end;
$$;

alter table public.rentals
  add column if not exists late_days integer not null default 0 check (late_days >= 0),
  add column if not exists late_fee_amount integer not null default 0 check (late_fee_amount >= 0);

create or replace function public.check_initial_late_fee()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.late_days <> 0 or new.late_fee_amount <> 0 then
    raise exception 'Denda awal transaksi harus nol';
  end if;
  return new;
end;
$$;
drop trigger if exists rentals_check_initial_late_fee on public.rentals;
create trigger rentals_check_initial_late_fee before insert on public.rentals
for each row execute function public.check_initial_late_fee();

create or replace function public.assess_rental_late_fee()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.return_renter_confirmed_at is null and new.return_renter_confirmed_at is not null then
    new.late_days := greatest(
      (new.return_renter_confirmed_at at time zone 'Asia/Jakarta')::date - new.end_date, 0
    );
    new.late_fee_amount := round(
      new.total_price::numeric / new.days * 0.15 * new.late_days
    )::integer;
  end if;
  return new;
end;
$$;
drop trigger if exists rentals_assess_late_fee on public.rentals;
create trigger rentals_assess_late_fee before update of return_renter_confirmed_at on public.rentals
for each row execute function public.assess_rental_late_fee();

create or replace function public.notify_rental_late_fee()
returns trigger language plpgsql security definer set search_path = public as $$
declare item_owner uuid;
begin
  if old.return_renter_confirmed_at is null and new.return_renter_confirmed_at is not null
    and new.late_fee_amount > 0 then
    select owner_id into item_owner from public.items where id = new.item_id;
    insert into public.notifications (user_id, rental_id, kind, title, message, href)
    values (new.renter_id, new.id, 'late_fee:renter', 'Denda keterlambatan tercatat',
      'Pengembalian terlambat ' || new.late_days || ' hari. Denda Rp' || new.late_fee_amount || ' tercatat dan belum dibayar.',
      '/transactions') on conflict (rental_id, kind) do nothing;
    if item_owner is not null then
      insert into public.notifications (user_id, rental_id, kind, title, message, href)
      values (item_owner, new.id, 'late_fee:owner', 'Denda keterlambatan tercatat',
        'Penyewa mengonfirmasi pengembalian terlambat ' || new.late_days || ' hari. Denda Rp' || new.late_fee_amount || ' belum dibayar.',
        '/lend/requests') on conflict (rental_id, kind) do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists rentals_notify_late_fee on public.rentals;
create trigger rentals_notify_late_fee after update of return_renter_confirmed_at on public.rentals
for each row execute function public.notify_rental_late_fee();
