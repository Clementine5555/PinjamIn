create table if not exists public.item_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id bigint not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.item_favorites enable row level security;
grant select, insert, delete on public.item_favorites to authenticated;
create policy "Pengguna melihat favorit sendiri" on public.item_favorites for select to authenticated using (user_id = auth.uid());
create policy "Pengguna menyimpan favorit sendiri" on public.item_favorites for insert to authenticated with check (user_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "Pengguna menghapus favorit sendiri" on public.item_favorites for delete to authenticated using (user_id = auth.uid());

create or replace function public.item_booked_ranges(p_item_id bigint)
returns table(start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select r.start_date, r.end_date from public.rentals r
  where r.item_id = p_item_id and r.status in ('Disetujui', 'Sedang disewa')
    and r.end_date >= current_date
  order by r.start_date;
$$;
revoke all on function public.item_booked_ranges(bigint) from public;
grant execute on function public.item_booked_ranges(bigint) to anon, authenticated;

create table if not exists public.student_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_number text not null check (length(student_number) between 4 and 30),
  university text not null check (length(university) between 3 and 100),
  ktm_path text not null,
  ktp_path text not null,
  status text not null default 'Menunggu' check (status in ('Menunggu', 'Disetujui', 'Ditolak')),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.student_verifications enable row level security;
revoke all on public.student_verifications from public, anon, authenticated;
grant select on public.student_verifications to authenticated;
create policy "Pemohon atau admin melihat verifikasi" on public.student_verifications for select to authenticated
  using (user_id = auth.uid() or auth.jwt()->'app_metadata'->>'seru_role' = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-verifications', 'student-verifications', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "Pemohon atau admin membaca dokumen" on storage.objects for select to authenticated
  using (bucket_id = 'student-verifications' and
    ((storage.foldername(name))[1] = auth.uid()::text or auth.jwt()->'app_metadata'->>'seru_role' = 'admin'));
create policy "Pemohon mengunggah dokumen sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-verifications' and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);
create policy "Pemohon menghapus dokumen sendiri" on storage.objects for delete to authenticated
  using (bucket_id = 'student-verifications' and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.student_verifications v where v.ktm_path = name or v.ktp_path = name));

create or replace function public.submit_student_verification(p_student_number text, p_university text, p_ktm_path text, p_ktp_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
    or auth.jwt()->'app_metadata'->>'seru_role' = 'admin' then raise exception 'Akun pengguna diperlukan'; end if;
  if length(trim(p_student_number)) not between 4 and 30 or length(trim(p_university)) not between 3 and 100
    or p_ktm_path not like auth.uid()::text || '/ktm-%'
    or p_ktp_path not like auth.uid()::text || '/ktp-%' then raise exception 'Data verifikasi tidak valid'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'student-verifications' and name = p_ktm_path)
    or not exists (select 1 from storage.objects where bucket_id = 'student-verifications' and name = p_ktp_path) then
    raise exception 'Dokumen belum terunggah'; end if;
  insert into public.student_verifications (user_id, student_number, university, ktm_path, ktp_path)
  values (auth.uid(), trim(p_student_number), trim(p_university), p_ktm_path, p_ktp_path)
  on conflict (user_id) do update set student_number = excluded.student_number,
    university = excluded.university, ktm_path = excluded.ktm_path, ktp_path = excluded.ktp_path,
    status = 'Menunggu', reviewer_note = null, reviewed_at = null, updated_at = now()
  where public.student_verifications.status = 'Ditolak';
  if not found then raise exception 'Pengajuan sebelumnya masih diproses atau sudah disetujui'; end if;
end;
$$;
revoke all on function public.submit_student_verification(text,text,text,text) from public, anon;
grant execute on function public.submit_student_verification(text,text,text,text) to authenticated;

create or replace function public.review_student_verification(p_user_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.jwt()->'app_metadata'->>'seru_role' is distinct from 'admin' or p_status not in ('Disetujui','Ditolak')
    or (p_status = 'Ditolak' and length(trim(coalesce(p_note,''))) < 5) then raise exception 'Peninjauan tidak valid'; end if;
  update public.student_verifications set status = p_status, reviewer_note = nullif(trim(p_note),''),
    reviewed_at = now(), updated_at = now() where user_id = p_user_id and status = 'Menunggu';
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;
  insert into public.notifications (user_id, kind, title, message, href)
  values (p_user_id, 'student_verification:' || extract(epoch from now())::bigint,
    'Verifikasi mahasiswa ' || lower(p_status), coalesce(nullif(trim(p_note),''), 'Periksa status verifikasimu.'), '/verification');
end;
$$;
revoke all on function public.review_student_verification(uuid,text,text) from public, anon;
grant execute on function public.review_student_verification(uuid,text,text) to authenticated;

create or replace function public.is_verified_student(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_verifications
    where user_id = p_user_id and status = 'Disetujui');
$$;
revoke all on function public.is_verified_student(uuid) from public;
grant execute on function public.is_verified_student(uuid) to anon, authenticated;

create or replace function public.owner_has_premium(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.premium_memberships
    where user_id = p_user_id and active_until > now());
$$;
revoke all on function public.owner_has_premium(uuid) from public;
grant execute on function public.owner_has_premium(uuid) to anon, authenticated;

create table if not exists public.item_boosts (
  item_id bigint primary key references public.items(id) on delete cascade,
  boosted_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.item_boosts enable row level security;
grant select on public.item_boosts to anon, authenticated;
create policy "Boost dapat dilihat publik" on public.item_boosts for select to anon, authenticated using (true);
create or replace function public.boost_my_item(p_item_id bigint)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare expiry timestamptz;
begin
  if auth.uid() is null or not exists (select 1 from public.items where id = p_item_id and owner_id = auth.uid() and is_available)
    or not exists (select 1 from public.premium_memberships where user_id = auth.uid() and active_until > now()) then
    raise exception 'Boost hanya untuk barang aktif milik anggota Premium'; end if;
  if exists (select 1 from public.item_boosts where item_id = p_item_id and boosted_until > now()) then
    raise exception 'Boost barang ini masih aktif'; end if;
  expiry := now() + interval '7 days';
  insert into public.item_boosts (item_id, boosted_until) values (p_item_id, expiry)
  on conflict (item_id) do update set boosted_until = excluded.boosted_until, updated_at = now();
  return expiry;
end;
$$;
revoke all on function public.boost_my_item(bigint) from public, anon;
grant execute on function public.boost_my_item(bigint) to authenticated;

create table if not exists public.item_waitlist (
  item_id bigint not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (item_id, user_id)
);
alter table public.item_waitlist enable row level security;
grant select, insert, delete on public.item_waitlist to authenticated;
create policy "Pengguna melihat antrean sendiri" on public.item_waitlist for select to authenticated using (user_id = auth.uid());
create policy "Pengguna masuk antrean" on public.item_waitlist for insert to authenticated
  with check (user_id = auth.uid() and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    and exists (select 1 from public.items where id = item_id and owner_id is distinct from auth.uid() and is_rented)
    and exists (select 1 from public.premium_memberships where user_id = auth.uid() and active_until > now()));
create policy "Pengguna keluar antrean" on public.item_waitlist for delete to authenticated using (user_id = auth.uid());
create or replace function public.notify_waitlist_available()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_rented and not new.is_rented and new.is_available then
    insert into public.notifications (user_id, kind, title, message, href)
    select w.user_id, 'waitlist:' || new.id || ':' || extract(epoch from now())::bigint,
      'Barang kembali tersedia', new.title || ' sudah tersedia lagi. Cek jadwal sebelum mengajukan sewa.', '/items/' || new.id
    from public.item_waitlist w where w.item_id = new.id and w.notified_at is null;
    update public.item_waitlist set notified_at = now() where item_id = new.id and notified_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists items_notify_waitlist on public.items;
create trigger items_notify_waitlist after update of is_rented on public.items
for each row execute function public.notify_waitlist_available();

create table if not exists public.rental_condition_reports (
  rental_id bigint not null references public.rentals(id) on delete cascade,
  stage text not null check (stage in ('handoff','return')),
  author_id uuid not null references auth.users(id),
  condition_note text not null check (length(condition_note) between 10 and 1000),
  photo_path text not null,
  created_at timestamptz not null default now(),
  primary key (rental_id, stage, author_id)
);
alter table public.rental_condition_reports enable row level security;
grant select, insert on public.rental_condition_reports to authenticated;
create policy "Peserta melihat bukti kondisi" on public.rental_condition_reports for select to authenticated
  using (exists (select 1 from public.rentals r join public.items i on i.id = r.item_id
    where r.id = rental_id and (r.renter_id = auth.uid() or i.owner_id = auth.uid())));
create policy "Peserta mengirim bukti kondisi" on public.rental_condition_reports for insert to authenticated
  with check (author_id = auth.uid() and photo_path like auth.uid()::text || '/%'
    and exists (select 1 from public.rentals r join public.items i on i.id = r.item_id
      where r.id = rental_id and (r.renter_id = auth.uid() or i.owner_id = auth.uid())
        and ((stage = 'handoff' and r.status = 'Disetujui') or (stage = 'return' and r.status = 'Sedang disewa'))));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rental-condition', 'rental-condition', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "Peserta unggah foto kondisi" on storage.objects for insert to authenticated
  with check (bucket_id = 'rental-condition' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Peserta lihat foto kondisi" on storage.objects for select to authenticated
  using (bucket_id = 'rental-condition' and exists (
    select 1 from public.rental_condition_reports c join public.rentals r on r.id = c.rental_id
    join public.items i on i.id = r.item_id where c.photo_path = name
      and (r.renter_id = auth.uid() or i.owner_id = auth.uid())));
create policy "Pemilik unggahan menghapus foto tidak terpakai" on storage.objects for delete to authenticated
  using (bucket_id = 'rental-condition' and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.rental_condition_reports c where c.photo_path = name));

create or replace function public.validate_rental_request()
returns trigger language plpgsql set search_path = public as $$
declare item_price integer; maximum_days integer;
begin
  if new.status <> 'Menunggu persetujuan'
    or new.handoff_renter_confirmed_at is not null or new.handoff_owner_confirmed_at is not null
    or new.return_renter_confirmed_at is not null or new.return_owner_confirmed_at is not null then
    raise exception 'Status awal permintaan sewa tidak valid'; end if;
  maximum_days := case when exists (select 1 from public.premium_memberships m
    where m.user_id = new.renter_id and m.active_until > now()) then 7 else 3 end;
  if new.start_date < current_date or new.days not between 1 and maximum_days
    or new.end_date <> new.start_date + new.days then raise exception 'Tanggal atau durasi sewa tidak valid'; end if;
  select price_per_day into item_price from public.items where id = new.item_id;
  if item_price is null or new.total_price::bigint <> item_price::bigint * new.days then
    raise exception 'Total sewa tidak sesuai harga barang'; end if;
  return new;
end;
$$;
