alter table public.rental_reviews
  add column if not exists moderation_status text not null default 'Menunggu'
  check (moderation_status in ('Menunggu', 'Disetujui', 'Ditolak'));

create or replace function public.sync_review_publication()
returns trigger language plpgsql set search_path = public as $$
begin
  new.is_published := new.moderation_status = 'Disetujui';
  return new;
end;
$$;

drop trigger if exists rental_reviews_sync_publication on public.rental_reviews;
create trigger rental_reviews_sync_publication
before insert or update of moderation_status on public.rental_reviews
for each row execute function public.sync_review_publication();

update public.rental_reviews
set moderation_status = 'Disetujui'
where moderation_status = 'Menunggu' and is_published;

create or replace view public.item_rating_summary with (security_barrier = true) as
select item_id, count(*)::integer as rating_count, round(avg(rating)::numeric, 1) as rating_average
from public.rental_reviews
where moderation_status = 'Disetujui'
group by item_id;

create or replace view public.published_item_reviews with (security_barrier = true) as
select id, item_id, rating, comment, created_at
from public.rental_reviews
where moderation_status = 'Disetujui' and comment <> '';

revoke all on public.item_rating_summary, public.published_item_reviews from public, anon, authenticated;
grant select on public.item_rating_summary, public.published_item_reviews to anon, authenticated;

grant update (moderation_status) on public.rental_reviews to authenticated;
grant update (status) on public.rental_reports to authenticated;

drop policy if exists "Admin melihat semua ulasan" on public.rental_reviews;
create policy "Admin melihat semua ulasan" on public.rental_reviews
for select to authenticated
using (auth.jwt()->'app_metadata'->>'seru_role' = 'admin');

drop policy if exists "Admin memoderasi ulasan" on public.rental_reviews;
create policy "Admin memoderasi ulasan" on public.rental_reviews
for update to authenticated
using (auth.jwt()->'app_metadata'->>'seru_role' = 'admin')
with check (auth.jwt()->'app_metadata'->>'seru_role' = 'admin');

drop policy if exists "Admin melihat semua laporan" on public.rental_reports;
create policy "Admin melihat semua laporan" on public.rental_reports
for select to authenticated
using (auth.jwt()->'app_metadata'->>'seru_role' = 'admin');

drop policy if exists "Admin menangani laporan" on public.rental_reports;
create policy "Admin menangani laporan" on public.rental_reports
for update to authenticated
using (auth.jwt()->'app_metadata'->>'seru_role' = 'admin')
with check (auth.jwt()->'app_metadata'->>'seru_role' = 'admin');
