-- =====================================================================
-- SQL урсгалын тест (CI): агент, зарын хугацаа, гомдол, онцлох зар, шимтгэл, алдааны бүртгэл, RLS.
-- stubs.sql -> schema.sql (2 удаа, idempotent шалгалт) -> энэ файл. Алдаа гарвал psql 1-ээр гарна.
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
update public.profiles set role = 'admin' where email = 'mgr@x.mn';  -- хоёр дахь админ
update public.profiles set profile_completed = true, full_name = 'Бат Болд', phone = '99112233';

-- 1. Агент урих -> код үүснэ, кодоор олдоно
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
select pg_temp.eq((select count(*)::int from public.notifications where type = 'ad_flag'), 2, 'админуудад мэдэгдэл');
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

-- 6. Хугацаа: сануулга -> дууссан -> нийтээс хасагдана -> сунгах
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
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.error_logs), 0, 'хэрэглэгч алдааны бүртгэл харахгүй');
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


-- 10. Утас: нийтэд харагдахгүй, нэвтэрсэн хүн RPC-ээр, бүртгэлтэй
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.sign_contract('Бат Болд','99112233','Lexus','RX',2019,'5678 УНА','LX999',80000000,'M 1 1 L 50 50 L 60 60 Z') as cid2 \gset
insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, contract_id)
values ('00000000-0000-0000-0000-00000000000c','Lexus','RX','5678 УНА','LX999','99112233',2019,80000000,'{b.jpg}', :'cid2') returning id as ad2 \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.approve_ad(:'ad2');
reset role;
select pg_temp.fails($$select phone from public.public_ads limit 1$$, 'public_ads-д утас байхгүй');
select pg_temp.as_user('');
set role anon;
select pg_temp.fails(format($$select public.reveal_phone(%L)$$, :'ad2'), 'нэвтрээгүй хүн утас харахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.eq(public.reveal_phone(:'ad2'), '99112233', 'нэвтэрсэн хүн утас харна');
select public.reveal_phone(:'ad2');
select pg_temp.eq((select count(*)::int from public.ad_phone_views), 0, 'хэрэглэгч бусдын бүртгэл харахгүй');
reset role;
select pg_temp.eq((select times from public.ad_phone_views where ad_id = :'ad2'), 2, 'харсан тоо');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.eq((select phone_views from public.ad_interest(:'ad2')), 1, 'эзэн сонирхсон хүний тоог харна');
reset role;

-- 11. Чат
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select public.start_chat(:'ad2', 'Сайн байна уу, машин байгаа юу?') as conv \gset
select pg_temp.eq(public.start_chat(:'ad2', 'Дахиад нэг асуулт'), :'conv'::uuid, 'нэг зарт нэг чат');
select pg_temp.fails(format($$select public.send_message(%L, '   ')$$, :'conv'), 'хоосон мессеж');
reset role;
select pg_temp.eq((select count(*)::int from public.notifications where type = 'message'), 1, 'мэдэгдэл 10 минутад нэг');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.eq(public.chat_unread(), 2, 'худалдагчид 2 уншаагүй');
select pg_temp.eq((select other_name from public.my_chats() limit 1), 'Бат', 'нөгөө талын нэр');
select public.send_message(:'conv', 'Байгаа, хэзээ үзэх вэ?');
select public.mark_chat_read(:'conv');
select pg_temp.eq(public.chat_unread(), 0, 'уншсан');
select pg_temp.fails(format($$select public.start_chat(%L, 'hi')$$, :'ad2'), 'өөрийн зартай чатлахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.messages), 0, 'гуравдагч хүн мессеж харахгүй');
select pg_temp.fails(format($$select public.send_message(%L, 'hack')$$, :'conv'), 'гуравдагч хүн бичихгүй');
select pg_temp.fails($$insert into public.messages(conversation_id, sender_id, body) values (gen_random_uuid(), auth.uid(), 'x')$$, 'шууд insert хориотой');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.messages), 3, 'админ чат уншина');
reset role;
select pg_temp.eq(public.notify_url('message', null), '/messages', 'чатын push холбоос');


-- 12. Push токен: нэг утсан дээр аккаунт солиход шинэ хэрэглэгчид шилжинэ
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.save_push_token('ExponentPushToken[abc123]', 'android');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select public.save_push_token('ExponentPushToken[abc123]', 'android');
select pg_temp.fails($$select public.save_push_token('bad-token', 'android')$$, 'буруу токен');
select pg_temp.eq(public.test_push(), 1, 'туршилтын мэдэгдэл');
reset role;
select pg_temp.eq((select user_id from public.push_tokens where token = 'ExponentPushToken[abc123]'), '00000000-0000-0000-0000-00000000000e'::uuid, 'токен шинэ хэрэглэгчид шилжсэн');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select public.remove_push_token('ExponentPushToken[abc123]');
reset role;
select pg_temp.eq((select count(*)::int from public.push_tokens where token = 'ExponentPushToken[abc123]'), 0, 'гарахад токен устсан');

-- 13. Хоёр сонголт: төлбөртэй (шимтгэлгүй) зар, вэбээс батлах
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.fails($$insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos)
  values ('00000000-0000-0000-0000-00000000000c','Honda','Fit','5555 УБА','GP5-1','99112233',2016,20000000,'{a.jpg}')$$, 'шимтгэлтэй зар гэрээгүй орохгүй');
insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, plan)
values ('00000000-0000-0000-0000-00000000000c','Honda','Fit','5555 УБА','GP5-1','99112233',2016,20000000,'{a.jpg}','paid') returning id as pad \gset
select id as pay from public.payments where ad_id = :'pad' \gset
select pg_temp.eq((select (status, amount, days)::text from public.payments where id = :'pay'), '(awaiting,70000,10)', 'төлбөр автоматаар үүссэн');
select pg_temp.eq(public.open_payment(:'pad'), :'pay'::uuid, 'нээлттэй төлбөрийг дахин ашиглана');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select pg_temp.fails(format($$select public.approve_ad(%L)$$, :'pad'), 'төлбөргүй зарыг батлахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.payments), 0, 'бусдын төлбөр харагдахгүй');
select pg_temp.fails(format($$select public.submit_payment(%L, null)$$, :'pay'), 'бусдын төлбөрийг илгээхгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.submit_payment(:'pay', 'Б.Болд, Хаан банк');
select pg_temp.fails(format($$select public.submit_payment(%L, null)$$, :'pay'), 'давхар илгээхгүй');
reset role;
select pg_temp.eq((select count(*)::int from public.notifications where type = 'payment_submitted'), 2, 'админ бүрт төлбөрийн мэдэгдэл (2 админ)');
set role anon;
select pg_temp.fails(format($$select public.decide_payment(%L, true)$$, :'pay'), 'нэвтрээгүй хүн төлбөр батлахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.eq(public.decide_payment(:'pay', true), '✅ Батлагдлаа', 'админ вэбээс батлав');
select pg_temp.eq(public.decide_payment(:'pay', false), 'Аль хэдийн батлагдсан', 'давхар дарахад өөрчлөгдөхгүй');
reset role;
select pg_temp.eq((select (status, decided_via)::text from public.payments where id = :'pay'), '(confirmed,web)', 'төлбөр батлагдсан');
select pg_temp.eq(to_regclass('public.telegram_config') is null, true, 'Telegram хүснэгт байхгүй');
select pg_temp.eq((select (status, approved_at is not null, manager_id is null)::text from public.ads where id = :'pad'), '(active,t,t)', 'төлбөр батлагдмагц зар менежергүй шууд нийтлэгдсэн');
select pg_temp.eq((select count(*)::int from public.notifications where type = 'staff_new_ad' and title like 'Төлбөр орсон%'), 0, 'менежерт «батлахад бэлэн» мэдэгдэл очихгүй');
select pg_temp.eq((select round(extract(epoch from featured_until - now()) / 86400)::int from public.ads where id = :'pad'), 10, 'төлбөртэй зар 10 хоног онцлох');
select pg_temp.eq((select expires_at > now() + interval '50 days' from public.ads where id = :'pad'), true, 'нийтлэгдэхэд зарын хугацаа эхэлсэн');
select pg_temp.eq((select applied_at is not null from public.payments where id = :'pay'), true, 'онцлох хугацаа хэрэглэгдсэн');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.eq((select percent from public.commission_for(:'pad')), 0::numeric, 'төлбөртэй сонголтод шимтгэл 0%');
-- Нийтлэгдсэн зарыг дахин онцлох: вэбээс «ороогүй» гэж тэмдэглэнэ
select public.open_payment(:'pad') as pay2 \gset
select public.submit_payment(:'pay2', null);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.fails(format($$select public.decide_payment(%L, true)$$, :'pay2'), 'хэрэглэгч төлбөр батлахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.eq(public.decide_payment(:'pay2', false, 'Дүн дутуу'), '❌ Ороогүй гэж тэмдэглэлээ', 'вэбээс ороогүй');
reset role;
select pg_temp.eq((select count(*)::int from public.notifications where type = 'payment_rejected'), 1, 'хэрэглэгчид «ороогүй» мэдэгдэл');
select pg_temp.eq(public.notify_url('payment_ok', :'pad'), '/pay/' || :'pad', 'push холбоос (төлбөр)');

-- 14. Шимтгэлтэй зар батлахад үнэгүй онцлох (тохиргооны хоног)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select public.sign_contract('Бат Болд','99112233','Mazda','CX-5',2019,'7777 УБА','KF-1',50000000,'M 1 1 L 50 50 L 60 60 Z') as cid2 \gset
insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, contract_id)
values ('00000000-0000-0000-0000-00000000000c','Mazda','CX-5','7777 УБА','KF-1','99112233',2019,50000000,'{a.jpg}', :'cid2') returning id as cad \gset
reset role;
select pg_temp.eq((select count(*)::int from public.payments where ad_id = :'cad'), 0, 'шимтгэлтэй зарт төлбөр үүсэхгүй');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select public.approve_ad(:'cad');
reset role;
select pg_temp.eq((select round(extract(epoch from featured_until - now()) / 86400)::int from public.ads where id = :'cad'), 7, 'шимтгэлтэй зар 7 хоног онцлох');

-- 15. Банкны орлогын SMS-ээр төлбөр автоматаар батлах
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, plan)
values ('00000000-0000-0000-0000-00000000000c','Toyota','Aqua','8888 УБА','NHP10-1','99112233',2015,18000000,'{a.jpg}','paid') returning id as sad \gset
select pg_temp.fails($$select public.sms_admin()$$, 'хэрэглэгч SMS түлхүүр харахгүй');
reset role;
select id as spay, ref as sref, amount as samt from public.payments where ad_id = :'sad' \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select (public.sms_admin()->>'api_key') as skey \gset
reset role;
set role anon;
select pg_temp.fails($$select public.sms_ingest('wrong', '1000', '', 'x', '1800', 'd')$$, 'SMS: буруу түлхүүр');
select pg_temp.fails($$select count(*) from public.sms_config$$, 'SMS түлхүүр нийтэд харагдахгүй');
select pg_temp.eq(public.sms_ingest(:'skey', '1', 'TEST', 'TEST', 'test', 'd')->>'result', 'test', 'SMS: туршилт');
select pg_temp.eq(public.sms_ingest(:'skey', '', '', 'ZARLAGA', '1800', 'd0')->>'result', 'skip', 'SMS: дүнгүй бол алгасна');
select pg_temp.eq(public.sms_ingest(:'skey', (:samt - 1)::text, :'sref', 'ORLOGO: ' || (:samt - 1) || ' MNT utga: ' || :'sref', '1800', 'd1')->>'result',
  'short', 'SMS: дүн дутуу бол батлахгүй');
select pg_temp.eq(public.sms_ingest(:'skey', '5000', 'MZZZZZZZ', 'ORLOGO: 5,000.00 MNT utga: busad', '1800', 'd2')->>'result',
  'unmatched', 'SMS: код олдоогүй');
select pg_temp.eq(public.sms_ingest(:'skey', :samt::text, '', 'Khan bank: dansand ORLOGO: ' || :samt || '.00 MNT, Guilgeenii utga: ' || lower(substr(:'sref', 1, 4)) || ' ' || lower(substr(:'sref', 5)) || ', uldegdel', '1800', 'd3')->>'result',
  'confirmed', 'SMS: код (жижиг үсэг, зайтай) таарч батлав');
select pg_temp.eq(public.sms_ingest(:'skey', :samt::text, '', 'Khan bank: dansand ORLOGO: ' || :samt || '.00 MNT, Guilgeenii utga: ' || lower(substr(:'sref', 1, 4)) || ' ' || lower(substr(:'sref', 5)) || ', uldegdel', '1800', 'd3')->>'result',
  'duplicate', 'SMS: давхар ирэхэд дахин бүртгэхгүй');
select pg_temp.eq(public.sms_ingest(:'skey', :samt::text, :'sref', 'ORLOGO utga ' || :'sref', '1800', 'd4')->>'result', 'already', 'SMS: аль хэдийн батлагдсан');
select pg_temp.fails($$select count(*) from public.sms_income$$, 'SMS жагсаалт нийтэд харагдахгүй');
reset role;
select pg_temp.eq((select (status, decided_via, decided_name)::text from public.payments where id = :'spay'), '(confirmed,sms,"SMS · банк")', 'төлбөр SMS-ээр батлагдсан');
select pg_temp.eq((select count(*)::int from public.notifications where type = 'payment_ok' and ad_id = :'sad'), 1, 'хэрэглэгчид «баталгаажлаа» мэдэгдэл');
select pg_temp.eq((select status from public.ads where id = :'sad'), 'active', 'SMS-ээр төлсөн зар шууд нийтлэгдсэн');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.eq((select count(*)::int from public.sms_income), 0, 'хэрэглэгч ирсэн SMS харахгүй');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.eq((select string_agg(result, ',' order by result) from public.sms_income), 'already,confirmed,short,unmatched', 'админ ирсэн SMS-ийг харна');
select public.regen_sms_key();
select pg_temp.eq((public.sms_admin()->>'api_key') <> :'skey', true, 'түлхүүр солигдсон');
reset role;

-- 16. Менежер эрх байхгүй, эрх/спамын хамгаалалт
reset role;
select pg_temp.as_user('');
select pg_temp.fails($$update public.profiles set role = 'manager' where email = 'buyer@x.mn'$$, 'менежер эрх байхгүй (constraint)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.fails($$select public.invite_staff('new@x.mn', 'manager')$$, 'менежер урьж болохгүй');
select pg_temp.eq(public.is_staff(), true, 'админ = ажилтан');
select public.invite_staff('boss@x.mn', 'admin');
reset role;
select pg_temp.eq((select role from public.staff_invites where email = 'boss@x.mn'), 'admin', 'админы урилга');
select pg_temp.eq(public.notify_url('staff_new_ad', '00000000-0000-0000-0000-0000000000ff'), '/admin/review?id=00000000-0000-0000-0000-0000000000ff', 'push холбоос /admin/review');
select pg_temp.eq(public.notify_url('ad_flag', null), '/admin/flags', 'push холбоос /admin/flags');
select pg_temp.eq(public.notify_url('report_reviewed', null), '/admin/reports', 'push холбоос /admin/reports');
-- Хэрэглэгч өөрийгөө админ болгож чадахгүй (баганын эрх + trigger)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
set role authenticated;
select pg_temp.eq(public.is_staff(), false, 'хэрэглэгч ажилтан биш');
select pg_temp.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'өөрийгөө админ болгохгүй (RLS)');
reset role;
select pg_temp.fails($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000e'$$, 'өөрийгөө админ болгохгүй (trigger)');
select pg_temp.fails($$update public.profiles set is_blocked = true where id = '00000000-0000-0000-0000-00000000000a'$$, 'хэрэглэгч бусдыг хаахгүй (trigger)');
-- Зар оруулах хурдны хязгаар: өдөрт 10
do $$
begin
  for i in 1..10 loop
    insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, plan)
    values ('00000000-0000-0000-0000-00000000000e', 'Kia', 'Ray', i || '00 УНА', 'VIN' || i, '99112233', 2015, 9000000, '{a.jpg}', 'paid');
  end loop;
end $$;
select pg_temp.fails($$insert into public.ads(user_id, brand, model, plate_number, vin, phone, year_made, price, photos, plan)
  values ('00000000-0000-0000-0000-00000000000e', 'Kia', 'Ray', '999 УНА', 'VIN99', '99112233', 2015, 9000000, '{a.jpg}', 'paid')$$, 'өдөрт 10-аас олон зар оруулахгүй');
-- Зургийн сан: зөвхөн зураг
set role authenticated;
select pg_temp.fails($$insert into storage.objects(bucket_id, name) values ('ad-photos', '00000000-0000-0000-0000-00000000000e/x.svg')$$, 'зургийн санд SVG оруулахгүй');
select pg_temp.fails($$insert into storage.objects(bucket_id, name) values ('ad-photos', '00000000-0000-0000-0000-00000000000a/x.jpg')$$, 'бусдын хавтаст зураг оруулахгүй');
insert into storage.objects(bucket_id, name) values ('ad-photos', '00000000-0000-0000-0000-00000000000e/ok.jpg');
reset role;
select pg_temp.eq((select count(*)::int from storage.objects where name like '%/ok.jpg'), 1, 'өөрийн хавтаст JPG оруулна');

\echo 'Бүх SQL тест амжилттай'
