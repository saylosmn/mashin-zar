-- =====================================================================
-- SQL урсгалын тест (CI): агент, зарын хугацаа, гомдол, онцлох зар, шимтгэл, алдааны бүртгэл, RLS.
-- stubs.sql → schema.sql (2 удаа, idempotent шалгалт) → энэ файл. Алдаа гарвал psql 1-ээр гарна.
-- =====================================================================
\set ON_ERROR_STOP 1
create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create or replace function pg_temp.eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then raise exception 'FAIL %: got %, expected %', label, actual, expected; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(sql text, label text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL %: expected an error', label;
exception when others then
  if sqlerrm like 'FAIL %' then raise; end if;
  raise notice 'ok  % (%)', label, sqlerrm;
end $$;

insert into auth.users(id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-00000000000a','admin@x.mn', now()),
 ('00000000-0000-0000-0000-00000000000b','mgr@x.mn', now()),
 ('00000000-0000-0000-0000-00000000000c','seller@x.mn', now()),
 ('00000000-0000-0000-0000-00000000000d','agent@x.mn', now()),
 ('00000000-0000-0000-0000-00000000000e','buyer@x.mn', now());
update public.profiles set role = 'admin' where email = 'admin@x.mn';
update public.profiles set role = 'manager' where email = 'mgr@x.mn';
update public.profiles set profile_completed = true, full_name = 'Бат Болд', phone = '99112233';

-- 1. Агент урих → код үүснэ, кодоор олдоно
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.invite_agent('agent@x.mn', 'Агент Дорж', '88001122');
reset role;
select pg_temp.eq((select role from public.profiles where email = 'agent@x.mn'), 'agent', 'агент эрх');
select pg_temp.eq((select agent_code ~ '^[A-Z2-9]{6}$' from public.profiles where email = 'agent@x.mn'), true, 'агентын код');
select pg_temp.eq((select count(*)::int from public.agent_by_code(lower((select agent_code from public.profiles where email = 'agent@x.mn')))), 1, 'кодоор хайх (жижиг үсэг)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.fails($$select public.invite_agent('x@x.mn')$$, 'хэрэглэгч агент урьж чадахгүй');
reset role;

-- 2. Зар оруулах: хэрэглэгч хугацаа/онцлохыг өөрөө тавьж чадахгүй, агент холбогдоно
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.sign_contract('Бат Болд','99112233','Toyota','Prius',2018,'1234 УБА','JTD123',35000000,'M 1 1 L 50 50 L 60 60 Z') as cid \gset
insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, contract_id, agent_id, featured_until, expires_at)
values ('00000000-0000-0000-0000-00000000000c','Toyota','Prius','1234 УБА','JTD123','99112233',2018,35000000,'{a.jpg}', :'cid',
        '00000000-0000-0000-0000-00000000000d', now() + interval '30 days', now() + interval '999 days') returning id as ad \gset
reset role;
select pg_temp.eq((select agent_id from public.ads where id = :'ad'), '00000000-0000-0000-0000-00000000000d'::uuid, 'зарт агент');
select pg_temp.eq((select featured_until is null and expires_at is null from public.ads where id = :'ad'), true, 'хэрэглэгч онцлох/хугацаа тавьж чадахгүй');

-- 3. Батлахад хугацаа эхэлнэ
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.approve_ad(:'ad');
reset role;
select pg_temp.eq((select round(extract(epoch from expires_at - now()) / 86400)::int from public.ads where id = :'ad'), 60, 'хугацаа 60 хоног');
set role anon;
select pg_temp.eq((select count(*)::int from public.public_ads where id = :'ad'), 1, 'нийтэд харагдана');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.ads where id = :'ad'), 1, 'агент өөрийн авчирсан зарыг харна');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.ads where id = :'ad'), 0, 'бусад хэрэглэгч ads хүснэгтээс харахгүй');

-- 4. Гомдол
select pg_temp.eq((select public.report_ad(:'ad', 'wrong_price', 'Үнэ өөр байна') is not null), true, 'гомдол илгээх');
select pg_temp.fails(format($$select public.report_ad(%L, 'fake', null)$$, :'ad'), 'нэг зарыг давхар мэдээлэхгүй');
select pg_temp.fails(format($$select public.report_ad(%L, 'other', '')$$, :'ad'), '«бусад» шалтгаан тайлбартай');
select pg_temp.eq((select count(*)::int from public.ad_flags), 0, 'хэрэглэгч гомдлын жагсаалт харахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.fails(format($$select public.report_ad(%L, 'fake', null)$$, :'ad'), 'өөрийн зарыг мэдээлэхгүй');
reset role;
select pg_temp.eq((select count(*)::int from public.notifications where type = 'ad_flag'), 2, 'менежер, админд мэдэгдэл');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.resolve_flag((select id from public.ad_flags limit 1), 'dismiss', null);
reset role;
select pg_temp.eq((select status from public.ad_flags limit 1), 'dismissed', 'гомдол хаагдсан');

-- 5. Онцлох зар
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.request_featured(:'ad');
select pg_temp.fails(format($$select public.request_featured(%L)$$, :'ad'), '24 цагт нэг хүсэлт');
select pg_temp.fails(format($$select public.set_featured(%L, 7)$$, :'ad'), 'хэрэглэгч өөрөө онцлох болгохгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.set_featured(:'ad', 7);
reset role;
select pg_temp.eq((select featured from public.public_ads where id = :'ad'), true, 'онцлох');
select pg_temp.eq((select featured_requested_at is null from public.ads where id = :'ad'), true, 'хүсэлт цэвэрлэгдсэн');

-- 6. Хугацаа: сануулга → дууссан → нийтээс хасагдана → сунгах
update public.ads set expires_at = now() + interval '2 days' where id = :'ad';
select pg_temp.eq(public.expire_ads_job(), 1, 'сануулга');
select pg_temp.eq(public.expire_ads_job(), 0, 'давхар сануулахгүй');
update public.ads set expires_at = now() - interval '1 hour' where id = :'ad';
select pg_temp.eq(public.expire_ads_job(), 1, 'дууссан мэдэгдэл');
select pg_temp.eq((select count(*)::int from public.public_ads where id = :'ad'), 0, 'дууссан зар нийтэд харагдахгүй');
select public.increment_view(:'ad');
select pg_temp.eq((select views from public.ads where id = :'ad'), 0, 'дууссан зарт үзэлт нэмэгдэхгүй');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.fails(format($$select public.renew_ad(%L)$$, :'ad'), 'бусдын зарыг сунгахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.eq(public.renew_ad(:'ad') > now() + interval '59 days', true, 'сунгасан');
select pg_temp.fails(format($$select public.renew_ad(%L)$$, :'ad'), 'шинэ сунгасан зарыг дахин сунгахгүй');
reset role;
select pg_temp.eq((select count(*)::int from public.public_ads where id = :'ad'), 1, 'сунгасны дараа харагдана');
select pg_temp.eq((select count(*)::int from public.notifications where ad_id = :'ad' and type in ('ad_expiring','ad_expired')), 2, 'хугацааны 2 мэдэгдэл');

-- 7. Борлуулалтын тайлан: агентын хувь (шимтгэлийн 50%)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.submit_sale_report(:'ad', 34000000, now(), null, null, null) as rid \gset
reset role;
select pg_temp.eq((select (commission_percent, commission_amount, agent_amount)::text from public.sale_reports where id = :'rid'), '(3.00,1020000,510000)', 'шимтгэл ба агентын хувь');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.fails(format($$select public.set_agent_paid(%L, true)$$, :'rid'), 'батлагдаагүй тайланд төлөхгүй');
select public.review_sale_report(:'rid', true, null);
select public.set_agent_paid(:'rid', true);
reset role;
select pg_temp.eq((select status from public.ads where id = :'ad'), 'sold', 'зар зарагдсан');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.eq((select sum(agent_amount)::bigint from public.sale_reports), 510000::bigint, 'агент өөрийн тайланг харна');
reset role;
select pg_temp.eq((select count(*)::int from public.notifications where type = 'agent_commission'), 2, 'агентад 2 мэдэгдэл (бодогдсон, төлсөн)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.sale_reports), 0, 'бусад хэрэглэгч тайлан харахгүй');
reset role;

-- 8. Алдааны бүртгэл: нэвтрээгүй ч илгээнэ, ижил алдааг нэгтгэнэ, зөвхөн админ уншина
select pg_temp.as_user('');
set role anon;
select public.log_client_error('web', 'TypeError at 12', 'stack', '/ads/1', 'UA', null);
select public.log_client_error('web', 'TypeError at 99', 'stack', '/ads/2', 'UA', null);
select pg_temp.fails($$select count(*) from public.error_logs$$, 'нэвтрээгүй хүн уншихгүй');
reset role;
select pg_temp.eq((select (count(*), max(hits))::text from public.error_logs), '(1,2)', 'ижил алдаа нэгтгэгдэнэ');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.error_logs), 0, 'менежер алдааны бүртгэл харахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.error_logs), 1, 'админ уншина');
reset role;

-- 9. Тохиргоо, push холбоос
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.fails($$select public.update_growth_settings(50, 50000, 7, 'http://bad.mn')$$, 'https биш хаяг');
select public.update_growth_settings(40, 70000, 10, 'https://MashinZar.mn/');
reset role;
select pg_temp.eq((select (agent_share, featured_price, featured_days, site_url)::text from public.settings), '(40.00,70000,10,https://mashinzar.mn)', 'тохиргоо');
select pg_temp.eq(public.notify_url('ad_expired', null), '/my', 'push холбоос');
select pg_temp.eq(public.notify_url('new_ad', '00000000-0000-0000-0000-0000000000ff'), '/ads/00000000-0000-0000-0000-0000000000ff', 'push холбоос (зар)');

\echo 'Бүх SQL тест амжилттай'
