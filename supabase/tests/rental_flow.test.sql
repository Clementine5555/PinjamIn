begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(67);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'seru-audit-owner@example.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seru-audit-renter@example.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'seru-audit-other@example.invalid');

insert into public.items (title, description, price_per_day, image_url, category, location, owner_id)
values ('SERU audit item', '', 18000, 'https://example.invalid/item.jpg', 'Elektronik', 'USU Medan', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 2, current_date + 3, 1, 18000
from public.items where title = 'SERU audit item';

insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 2, current_date + 3, 1, 18000
from public.items where title = 'SERU audit item';

create temp table audit_ids as
select min(id) as first_id, max(id) as second_id from public.rentals
where item_id = (select id from public.items where title = 'SERU audit item');
grant select on pg_temp.audit_ids to authenticated;

select ok((select relrowsecurity from pg_class where oid = 'public.items'::regclass), 'items uses RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.rentals'::regclass), 'rentals uses RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'messages uses RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), 'notifications uses RLS');

set local role anon;
select throws_ok($$select * from public.rentals$$, '42501', null, 'anon cannot read rentals');
select throws_ok($$select * from public.messages$$, '42501', null, 'anon cannot read messages');

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","is_anonymous":false}';

select is((select count(*)::integer from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 0, 'other user sees no rentals');
select is((select count(*)::integer from public.messages), 0, 'other user sees no messages');
select is((select count(*)::integer from public.notifications), 0, 'other user sees no notifications');
select throws_ok($$insert into public.messages (rental_id, sender_id, body)
  values ((select first_id from pg_temp.audit_ids), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'unauthorized')$$,
  '42501', null, 'other user cannot send messages');
select is_empty($$update public.items set title = 'SERU stolen item' where title = 'SERU audit item' returning id$$, 'other user cannot edit item');
select throws_ok($$select public.review_rental((select first_id from pg_temp.audit_ids), 'Disetujui')$$, 'P0001', null, 'other user cannot approve rental');
select throws_ok($$select public.cancel_rental((select first_id from pg_temp.audit_ids))$$, 'P0001', null, 'other user cannot cancel rental');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';

select is((select count(*)::integer from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 2, 'renter sees own rentals');
select results_eq($$insert into public.messages (rental_id, sender_id, body)
  select first_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'hello' from pg_temp.audit_ids returning body$$,
  array['hello'], 'renter sends chat message');
select throws_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 4, current_date + 5, 1, 1 from public.items where title = 'SERU audit item'$$,
  'P0001', null, 'renter cannot forge total price');
select throws_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 4, current_date + 8, 1, 18000 from public.items where title = 'SERU audit item'$$,
  'P0001', null, 'renter cannot forge rental dates');
select throws_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date - 2, current_date - 1, 1, 18000 from public.items where title = 'SERU audit item'$$,
  'P0001', null, 'renter cannot request past dates');
select throws_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price, status)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 4, current_date + 5, 1, 18000, 'Disetujui' from public.items where title = 'SERU audit item'$$,
  'P0001', null, 'renter cannot create an approved rental');
select throws_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price, handoff_renter_confirmed_at)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 4, current_date + 5, 1, 18000, now() from public.items where title = 'SERU audit item'$$,
  'P0001', null, 'renter cannot forge handoff confirmation');
select throws_ok($$update public.rentals set status = 'Selesai' where renter_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '42501', null, 'renter cannot update status directly');
select results_eq($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 10, current_date + 11, 1, 18000
  from public.items where title = 'SERU audit item' returning status$$,
  array['Menunggu persetujuan'], 'renter creates a valid request');
select lives_ok($$select public.cancel_rental((select max(id) from public.rentals))$$, 'renter cancels pending request');
select is((select status from public.rentals where id = (select max(id) from public.rentals)), 'Dibatalkan', 'cancelled request stays cancelled');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';

select is((select count(*)::integer from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 3, 'owner sees incoming rentals');
select throws_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date + 4, current_date + 5, 1, 18000 from public.items where title = 'SERU audit item'$$,
  '42501', null, 'owner cannot rent own item');
select lives_ok($$select public.review_rental((select first_id from pg_temp.audit_ids), 'Disetujui')$$, 'owner approves first rental');
select throws_ok($$select public.review_rental((select second_id from pg_temp.audit_ids), 'Disetujui')$$,
  'P0001', null, 'overlapping second rental is rejected');
select is((select status from public.rentals where id = (select second_id from pg_temp.audit_ids)), 'Menunggu persetujuan', 'overlapping request remains pending');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';
select throws_ok($$select public.confirm_rental_stage((select first_id from pg_temp.audit_ids), 'handoff')$$,
  'P0001', null, 'renter cannot confirm handoff before payment');

reset role;
insert into public.rental_payments (rental_id, order_id, amount, status, paid_at)
select first_id, 'seru-audit-paid', 18000, 'Dibayar', now() from pg_temp.audit_ids;
set local role authenticated;
select lives_ok($$select public.confirm_rental_stage((select first_id from pg_temp.audit_ids), 'handoff')$$, 'renter confirms handoff');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.confirm_rental_stage((select first_id from pg_temp.audit_ids), 'handoff')$$, 'owner confirms handoff');
select is((select status from public.rentals where id = (select first_id from pg_temp.audit_ids)), 'Sedang disewa', 'both handoff confirmations start rental');
select ok((select is_rented from public.items where title = 'SERU audit item'), 'item is unavailable while rented');
select throws_ok($$select public.confirm_rental_stage((select first_id from pg_temp.audit_ids), 'return')$$,
  'P0001', null, 'owner cannot confirm return before renter');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.confirm_rental_stage((select first_id from pg_temp.audit_ids), 'return')$$, 'renter confirms return');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.confirm_rental_stage((select first_id from pg_temp.audit_ids), 'return')$$, 'owner completes rental');
select is((select status from public.rentals where id = (select first_id from pg_temp.audit_ids)), 'Selesai', 'both return confirmations complete rental');
select ok(not (select is_rented from public.items where title = 'SERU audit item'), 'item becomes available after return');
select is((select count(*)::integer from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  1, 'completed paid rental creates one payout simulation');
select is((select platform_fee from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  1800, 'draft 10 percent platform fee is calculated');
select is((select owner_amount from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  16200, 'owner share matches rent less platform fee');
select throws_ok($$select public.mark_sandbox_payout((select first_id from pg_temp.audit_ids))$$,
  'P0001', null, 'owner cannot mark own payout simulation');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';
select is((select count(*)::integer from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  0, 'renter cannot read owner payout simulation');
select lives_ok($$insert into public.rental_reports (rental_id, reporter_id, reason, details)
  select first_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Lainnya', 'Barang kembali tetapi ada masalah kecil.'
  from pg_temp.audit_ids$$, 'renter can report a completed rental');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select is((select status from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  'Perlu peninjauan', 'open report flags the payout simulation');

set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","is_anonymous":false,"app_metadata":{"seru_role":"admin"}}';
select throws_ok($$select public.mark_sandbox_payout((select first_id from pg_temp.audit_ids))$$,
  'P0001', null, 'admin cannot mark payout while report is open');
select lives_ok($$update public.rental_reports set status = 'Selesai'
  where rental_id = (select first_id from pg_temp.audit_ids)$$, 'admin resolves rental report');
select is((select public.mark_sandbox_payout((select first_id from pg_temp.audit_ids))),
  'Tercatat simulasi', 'admin records payout simulation after report closes');
select is((select status from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  'Tercatat simulasi', 'payout simulation status is saved');
select lives_ok($$update public.rental_reports set status = 'Baru'
  where rental_id = (select first_id from pg_temp.audit_ids)$$, 'admin can reopen a report');
select is((select status from public.rental_payouts where rental_id = (select first_id from pg_temp.audit_ids)),
  'Perlu peninjauan', 'reopened report flags a recorded payout for review');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.review_rental((select second_id from pg_temp.audit_ids), 'Disetujui')$$, 'dates become available after completed rental');
select is((select status from public.rentals where id = (select second_id from pg_temp.audit_ids)), 'Disetujui', 'second request is approved after return');

reset role;
insert into public.rental_payments (rental_id, order_id, amount, status, paid_at)
select second_id, 'seru-audit-cancel', 18000, 'Dibayar', now() from pg_temp.audit_ids;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.request_rental_cancellation((select second_id from pg_temp.audit_ids), 'Jadwal tugas berubah')$$,
  'renter requests cancellation before handoff');
select is((select status from public.rental_cancellations where rental_id = (select second_id from pg_temp.audit_ids)),
  'Menunggu', 'cancellation waits for admin review');
select throws_ok($$select public.confirm_rental_stage((select second_id from pg_temp.audit_ids), 'handoff')$$,
  'P0001', null, 'handoff is blocked while cancellation is pending');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select throws_ok($$select public.cancel_owner_rental((select second_id from pg_temp.audit_ids), 'Barang diperlukan')$$,
  'P0001', null, 'owner cannot duplicate an existing cancellation request');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';
select lives_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 20, current_date + 21, 1, 18000
  from public.items where title = 'SERU audit item'$$, 'renter creates a new unpaid rental');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.review_rental((select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 'Disetujui')$$,
  'owner approves unpaid rental');
select is((select public.cancel_owner_rental((select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 'Barang diperlukan untuk tugas')),
  'Dibatalkan', 'owner directly cancels before a payment order exists');
select is((select status from public.rentals where id = (select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item'))),
  'Dibatalkan', 'unpaid rental is cancelled');

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":false}';
select lives_ok($$insert into public.rentals (item_id, renter_id, start_date, end_date, days, total_price)
  select id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date + 22, current_date + 23, 1, 18000
  from public.items where title = 'SERU audit item'$$, 'renter creates another rental');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select lives_ok($$select public.review_rental((select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 'Disetujui')$$,
  'owner approves rental before payment');
reset role;
insert into public.rental_payments (rental_id, order_id, amount, status, paid_at)
select max(id), 'seru-audit-owner-cancel', 18000, 'Dibayar', now() from public.rentals
where item_id = (select id from public.items where title = 'SERU audit item');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":false}';
select is((select public.cancel_owner_rental((select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 'Barang diperlukan untuk tugas')),
  'Menunggu', 'owner cancellation after payment awaits admin');
select is((select requested_by from public.rental_cancellations where rental_id = (select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item'))),
  'owner', 'paid cancellation identifies the owner as requester');
select throws_ok($$select public.confirm_rental_stage((select max(id) from public.rentals where item_id = (select id from public.items where title = 'SERU audit item')), 'handoff')$$,
  'P0001', null, 'owner cannot hand off during paid cancellation review');

select * from finish();
rollback;
