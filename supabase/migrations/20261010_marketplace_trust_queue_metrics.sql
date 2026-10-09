drop policy if exists "Pemilik menambahkan barang" on public.items;
create policy "Pemilik menambahkan barang" on public.items for insert to authenticated
with check (
  owner_id = auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
  and public.is_verified_student(auth.uid())
);

drop policy if exists "Pemilik mengunggah foto barang" on storage.objects;
create policy "Pemilik mengunggah foto barang" on storage.objects for insert to authenticated
with check (
  bucket_id = 'item-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
  and public.is_verified_student(auth.uid())
);

drop policy if exists "Pengguna membuat transaksi sendiri" on public.rentals;
create policy "Pengguna membuat transaksi sendiri" on public.rentals for insert to authenticated
with check (
  auth.uid() = renter_id
  and status = 'Menunggu persetujuan'
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  and coalesce(auth.jwt()->'app_metadata'->>'seru_role', '') <> 'admin'
  and public.is_verified_student(auth.uid())
  and exists (
    select 1 from public.items i
    where i.id = item_id and i.owner_id is distinct from auth.uid()
      and i.is_available and not i.is_rented
  )
);

alter table public.item_waitlist
  add column if not exists priority_until timestamptz,
  add column if not exists claimed_rental_id bigint references public.rentals(id) on delete set null;

update public.item_waitlist
set notified_at = null
where notified_at is not null and priority_until is null;

create index if not exists item_waitlist_order_idx
  on public.item_waitlist (item_id, notified_at, created_at, user_id);

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

  select w.user_id into active_user
  from public.item_waitlist w
  join public.premium_memberships m on m.user_id = w.user_id and m.active_until > now()
  where w.item_id = p_item_id and w.notified_at is not null
    and (w.priority_until > now() or (w.claimed_rental_id is not null and exists (
      select 1 from public.rentals r where r.id = w.claimed_rental_id and r.status = 'Menunggu persetujuan'
    )))
  order by w.created_at, w.user_id limit 1;
  if active_user is not null then return; end if;

  select w.user_id into next_user
  from public.item_waitlist w
  join public.premium_memberships m on m.user_id = w.user_id and m.active_until > now()
  where w.item_id = p_item_id and w.notified_at is null
  order by w.created_at, w.user_id limit 1;
  if next_user is null then return; end if;

  update public.item_waitlist
  set notified_at = now(), priority_until = now() + interval '24 hours'
  where item_id = p_item_id and user_id = next_user;
  insert into public.notifications (user_id, kind, title, message, href)
  values (next_user, 'queue_priority:' || p_item_id || ':' || extract(epoch from now())::bigint,
    'Giliranmu mengajukan sewa', listing.title || ' tersedia. Kamu punya prioritas 24 jam untuk mengajukan sewa.',
    '/items/' || p_item_id);
end;
$$;
revoke all on function public.advance_item_waitlist(bigint) from public, anon, authenticated;

create or replace function public.item_waitlist_state(p_item_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  my_row public.item_waitlist%rowtype;
  active_row public.item_waitlist%rowtype;
  my_position integer;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Akun terdaftar diperlukan';
  end if;
  perform public.advance_item_waitlist(p_item_id);
  select * into my_row from public.item_waitlist
    where item_id = p_item_id and user_id = auth.uid();
  select w.* into active_row from public.item_waitlist w
  join public.premium_memberships m on m.user_id = w.user_id and m.active_until > now()
  where w.item_id = p_item_id and w.notified_at is not null
    and (w.priority_until > now() or (w.claimed_rental_id is not null and exists (
      select 1 from public.rentals r where r.id = w.claimed_rental_id and r.status = 'Menunggu persetujuan'
    )))
  order by w.created_at, w.user_id limit 1;
  if my_row.user_id is not null and my_row.notified_at is null then
    select count(*)::integer + 1 into my_position from public.item_waitlist w
    where w.item_id = p_item_id and w.notified_at is null
      and (w.created_at, w.user_id) < (my_row.created_at, my_row.user_id);
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
revoke all on function public.item_waitlist_state(bigint) from public, anon;
grant execute on function public.item_waitlist_state(bigint) to authenticated;

create or replace function public.notify_waitlist_available()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (old.is_rented and not new.is_rented and new.is_available)
    or (not old.is_available and new.is_available and not new.is_rented) then
    perform public.advance_item_waitlist(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists items_notify_waitlist on public.items;
create trigger items_notify_waitlist after update of is_rented, is_available on public.items
for each row execute function public.notify_waitlist_available();

create or replace function public.advance_waitlist_after_exit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.notified_at is not null then perform public.advance_item_waitlist(old.item_id); end if;
  return old;
end;
$$;
drop trigger if exists item_waitlist_advance_after_exit on public.item_waitlist;
create trigger item_waitlist_advance_after_exit after delete on public.item_waitlist
for each row execute function public.advance_waitlist_after_exit();

create or replace function public.guard_waitlist_rental_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare active_row public.item_waitlist%rowtype;
begin
  perform public.advance_item_waitlist(new.item_id);
  select w.* into active_row from public.item_waitlist w
  join public.premium_memberships m on m.user_id = w.user_id and m.active_until > now()
  where w.item_id = new.item_id and w.notified_at is not null
    and (w.priority_until > now() or (w.claimed_rental_id is not null and exists (
      select 1 from public.rentals r where r.id = w.claimed_rental_id and r.status = 'Menunggu persetujuan'
    )))
  order by w.created_at, w.user_id limit 1;
  if active_row.user_id is not null
    and (active_row.user_id <> new.renter_id or active_row.claimed_rental_id is not null) then
    raise exception 'Barang sedang diprioritaskan untuk antrean Premium';
  end if;
  return new;
end;
$$;
drop trigger if exists rentals_guard_waitlist_request on public.rentals;
create trigger rentals_guard_waitlist_request before insert on public.rentals
for each row execute function public.guard_waitlist_rental_request();

create or replace function public.track_waitlist_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.item_waitlist set claimed_rental_id = new.id
  where item_id = new.item_id and user_id = new.renter_id
    and priority_until > now() and claimed_rental_id is null;
  return new;
end;
$$;
drop trigger if exists rentals_track_waitlist_request on public.rentals;
create trigger rentals_track_waitlist_request after insert on public.rentals
for each row execute function public.track_waitlist_request();

create or replace function public.finish_waitlist_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'Menunggu persetujuan'
    and new.status in ('Disetujui', 'Ditolak', 'Dibatalkan') then
    delete from public.item_waitlist where claimed_rental_id = new.id;
    if new.status <> 'Disetujui' then perform public.advance_item_waitlist(new.item_id); end if;
  elsif old.status = 'Disetujui' and new.status = 'Dibatalkan' then
    perform public.advance_item_waitlist(new.item_id);
  end if;
  return new;
end;
$$;
drop trigger if exists rentals_finish_waitlist_request on public.rentals;
create trigger rentals_finish_waitlist_request after update of status on public.rentals
for each row execute function public.finish_waitlist_request();

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
      join public.premium_memberships m on m.user_id = w.user_id and m.active_until > now()
      where w.item_id = new.item_id and w.notified_at is not null
        and (w.priority_until > now() or w.claimed_rental_id is not null)
        and w.claimed_rental_id is distinct from new.id) then
      raise exception 'Antrean Premium masih memiliki prioritas';
    end if;
  end if;
  return new;
end;
$$;

alter table public.rental_reports
  add column if not exists resolution_outcome text
    check (resolution_outcome in ('Tidak terbukti', 'Diselesaikan bersama', 'Ditangani manual')),
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id);
revoke update (status) on public.rental_reports from authenticated;

create or replace function public.admin_handle_report(
  p_report_id bigint, p_status text, p_outcome text default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare report_row public.rental_reports%rowtype;
begin
  if auth.uid() is null or auth.jwt()->'app_metadata'->>'seru_role' is distinct from 'admin' then
    raise exception 'Akses pengelola diperlukan';
  end if;
  if p_status not in ('Diproses', 'Selesai') then raise exception 'Status laporan tidak valid'; end if;
  if p_status = 'Selesai' and (
    p_outcome is null or p_outcome not in ('Tidak terbukti', 'Diselesaikan bersama', 'Ditangani manual')
    or length(trim(coalesce(p_note, ''))) not between 10 and 1000
  ) then raise exception 'Keputusan dan catatan penyelesaian diperlukan'; end if;
  update public.rental_reports set status = p_status,
    resolution_outcome = case when p_status = 'Selesai' then p_outcome else null end,
    resolution_note = case when p_status = 'Selesai' then trim(p_note) else null end,
    resolved_at = case when p_status = 'Selesai' then now() else null end,
    resolved_by = case when p_status = 'Selesai' then auth.uid() else null end
  where id = p_report_id and status <> 'Selesai' returning * into report_row;
  if not found then raise exception 'Laporan tidak ditemukan atau sudah selesai'; end if;
  insert into public.notifications (user_id, rental_id, kind, title, message, href)
  values (report_row.reporter_id, report_row.rental_id,
    'report:' || report_row.id || ':' || p_status,
    case when p_status = 'Selesai' then 'Laporan telah ditangani' else 'Laporan sedang ditinjau' end,
    case when p_status = 'Selesai' then trim(p_note) else 'Pengelola sedang meninjau laporanmu.' end,
    '/transactions/' || report_row.rental_id || '/feedback')
  on conflict (rental_id, kind) do nothing;
end;
$$;
revoke all on function public.admin_handle_report(bigint,text,text,text) from public, anon;
grant execute on function public.admin_handle_report(bigint,text,text,text) to authenticated;

alter table public.rentals add column if not exists was_approved boolean not null default false;
update public.rentals r set was_approved = true
where r.status in ('Disetujui', 'Sedang disewa', 'Selesai')
  or exists (select 1 from public.rental_payments p where p.rental_id = r.id);

create or replace function public.track_rental_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'Disetujui' then new.was_approved := true; end if;
  return new;
end;
$$;
drop trigger if exists rentals_track_approval on public.rentals;
create trigger rentals_track_approval before update of status on public.rentals
for each row execute function public.track_rental_approval();

create or replace function public.admin_marketplace_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  request_count bigint;
  approved_count bigint;
  report_count bigint;
  completed_renter_count bigint;
  repeat_renter_count bigint;
begin
  if auth.uid() is null or auth.jwt()->'app_metadata'->>'seru_role' is distinct from 'admin' then
    raise exception 'Akses pengelola diperlukan';
  end if;
  select count(*), count(*) filter (where was_approved)
  into request_count, approved_count from public.rentals;
  select count(distinct rental_id) into report_count from public.rental_reports;
  select count(distinct renter_id) into completed_renter_count
  from public.rentals where status = 'Selesai';
  select count(*) into repeat_renter_count from (
    select renter_id from public.rentals where status = 'Selesai'
    group by renter_id having count(*) >= 2
  ) repeated;
  return jsonb_build_object(
    'verified_users', (select count(*) from public.student_verifications where status = 'Disetujui'),
    'active_listings', (select count(*) from public.items where owner_id is not null and is_available and not is_rented),
    'requests', request_count,
    'approved_requests', approved_count,
    'approval_rate', coalesce(round(approved_count::numeric * 100 / nullif(request_count, 0), 1), 0),
    'completed_rentals', (select count(*) from public.rentals where status = 'Selesai'),
    'repeat_renters', repeat_renter_count,
    'repeat_rate', coalesce(round(repeat_renter_count::numeric * 100 / nullif(completed_renter_count, 0), 1), 0),
    'reported_rentals', report_count,
    'dispute_rate', coalesce(round(report_count::numeric * 100 / nullif(request_count, 0), 1), 0)
  );
end;
$$;
revoke all on function public.admin_marketplace_metrics() from public, anon;
grant execute on function public.admin_marketplace_metrics() to authenticated;
