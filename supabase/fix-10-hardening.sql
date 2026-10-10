-- =====================================================================
-- ЗАСВАР 10: Аюулгүй байдал + лизингийн хүсэлтийн хяналт (аудит)
--   * Функцийн эрх: нэвтрээгүй хүн зөвхөн шаардлагатай цөөн функц дуудна
--   * Зар устгах: тайлантай / зарагдсан зарыг устгахгүй; гэрээг дахин ашиглахгүй
--   * Ажилтны урилга: зөвхөн баталгаажсан и-мэйлтэй (Google) хэрэглэгчид эрх авна
--   * Авто худалдаа: админ татгалзсан зарыг өөрөө дахин нийтлэхгүй
--   * Хэт олон хүсэлт/гэрээ (спам) хязгаарлах
--   * Push токен, гэрээний PDF, баримтын санг хамгаалах
--   * Лизингийн хүсэлтийн үйл явдлын бүртгэл (loan_events): илгээсэн, төлөв,
--     баримт хэн хэзээ нээсэн — админ бүгдийг, компани өөрийнхөө хүсэлтийг харна
--   * Баримт олон хуудастай (id_front, bank_statement_2 … _5)
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй. fix-09-ийн дараа.
-- =====================================================================

-- ---------- 1. Тусламжийн функцуудын search_path ----------
alter function public.mask_plate(text) set search_path = public;
alter function public.mask_vin(text) set search_path = public;
alter function public.loan_monthly(numeric, numeric, int) set search_path = public;
alter function public.rd_birth_date(text) set search_path = public;
alter function public.loan_doc_kinds() set search_path = public;

-- ---------- 2. Зар устгах, гэрээ дахин ашиглах ----------
-- Эзэн нь борлуулалтын тайлангүй зараа устгана (зарагдсан зарыг устгахгүй).
-- Гэрээ нь "ашиглагдсан" хэвээр үлдэх тул өөр зарт дахин ашиглахгүй.
drop policy if exists ads_delete on public.ads;
create policy ads_delete on public.ads for delete using (
  public.is_admin()
  or (user_id = auth.uid() and status in ('pending','active','rejected','hidden')
      and not exists (select 1 from public.sale_reports r where r.ad_id = ads.id and r.status <> 'rejected'))
);

-- Зар устсан ч борлуулалтын тайлан хадгалагдана
alter table public.sale_reports alter column ad_id drop not null;
alter table public.sale_reports drop constraint if exists sale_reports_ad_id_fkey;
alter table public.sale_reports add constraint sale_reports_ad_id_fkey foreign key (ad_id) references public.ads(id) on delete set null;

-- Нэг гэрээ нэг л зарт (зар устсан ч дахин ашиглахгүй), улсын/арлын дугаар таарсан байх
alter table public.contracts add column if not exists consumed_at timestamptz;
update public.contracts set consumed_at = coalesce(consumed_at, signed_at) where ad_id is not null and consumed_at is null;

create or replace function public.ads_link_contract() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.contract_id is not null then
    update public.contracts set ad_id = new.id, consumed_at = coalesce(consumed_at, now()) where id = new.contract_id;
  end if;
  return null;
end $$;

drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert with check (
  user_id = auth.uid()
  and (status = 'pending' or (status = 'active' and public.my_role() = 'dealer'))
  and manager_id is null and offer_amount is null and sold_at is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_blocked and p.profile_completed)
  and (
    public.my_role() = 'dealer'
    or (ads.contract_id is not null
        and exists (select 1 from public.contracts c
                    where c.id = ads.contract_id and c.user_id = auth.uid() and c.ad_id is null and c.consumed_at is null
                      and regexp_replace(upper(c.plate_number), '\s', '', 'g') = regexp_replace(upper(ads.plate_number), '\s', '', 'g')
                      and regexp_replace(upper(c.vin), '\s', '', 'g') = regexp_replace(upper(ads.vin), '\s', '', 'g')))
  )
);

-- Шинэ зарт менежерийн талбаруудыг хэрэглэгч өөрөө бөглөж чадахгүй
create or replace function public.ads_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare cutoff int;
begin
  select cutoff_year into cutoff from public.settings where id = 1;
  new.category := case when new.year_made >= coalesce(cutoff, 2016) then 'new' else 'old' end;
  new.updated_at := now();
  if tg_op = 'INSERT' and not public.is_staff() then
    new.views := 0; new.contacted_at := null; new.manager_note := null; new.offer_percent := null;
    new.offer_sent_at := null; new.approved_at := null; new.sold_price := null;
  end if;
  -- Авто худалдааны шинэ зар шууд нийтлэгдэнэ
  if tg_op = 'INSERT' and new.status = 'pending'
     and exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'dealer' and not p.is_blocked) then
    new.status := 'active';
    new.approved_at := now();
  end if;
  return new;
end $$;

-- ---------- 3. Ажилтны урилга зөвхөн баталгаажсан и-мэйлд ----------
-- Google-ээр нэвтэрсэн (эсвэл и-мэйлээ баталгаажуулсан) хэрэглэгч
create or replace function public.email_verified(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null)
      or exists (select 1 from auth.identities i where i.user_id = p_user and i.provider <> 'email')
$$;

create or replace function public.apply_staff_invite(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inv public.staff_invites; pr public.profiles;
begin
  select * into pr from public.profiles where id = p_user;
  if pr.id is null or pr.role <> 'user' or not public.email_verified(p_user) then return; end if;
  select * into inv from public.staff_invites where lower(email) = lower(pr.email);
  if inv.email is null then return; end if;
  update public.profiles set role = inv.role, shop_name = coalesce(inv.shop_name, shop_name), partner_id = inv.partner_id,
         full_name = coalesce(full_name, inv.full_name), phone = coalesce(phone, inv.phone), is_blocked = false
  where id = p_user;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url', 'user')
  on conflict (id) do nothing;
  insert into public.activity_log(actor_id, action) values (new.id, 'Шинэ хэрэглэгч бүртгүүлэв: ' || coalesce(new.raw_user_meta_data->>'full_name', new.email));
  -- Урилгатай бол эрхийг зөвхөн баталгаажсан и-мэйлд олгоно
  if new.email_confirmed_at is not null then perform public.apply_staff_invite(new.id); end if;
  return new;
end $$;

-- И-мэйл баталгаажих / Google холбогдох үед урилгыг хэрэгжүүлнэ
create or replace function public.on_auth_verified() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_staff_invite(new.id);
  return null;
end $$;
create or replace function public.on_auth_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_staff_invite(new.user_id);
  return null;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.on_auth_verified();
do $$ begin
  drop trigger if exists on_auth_identity_added on auth.identities;
  create trigger on_auth_identity_added after insert on auth.identities
  for each row execute function public.on_auth_identity();
exception when others then raise notice 'auth.identities trigger: %', sqlerrm;
end $$;

-- Баталгаажаагүй и-мэйлтэй профайлыг ажилтан болгохгүй (invite_* функцууд и-мэйлээр эрх өгдөг)
create or replace function public.profiles_role_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and new.role <> 'user' and not public.email_verified(new.id) then
    new.role := old.role; new.partner_id := old.partner_id; new.shop_name := old.shop_name;
  end if;
  return new;
end $$;
drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before update of role on public.profiles
for each row execute function public.profiles_role_guard();

-- ---------- 4. Авто худалдаа: админы шийдвэрийг давахгүй ----------
create or replace function public.dealer_set_status(p_ad uuid, p_status text, p_price bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if not (public.is_admin() or coalesce(public.my_role() = 'dealer' and a.user_id = auth.uid(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if a.status = 'sold' then raise exception 'Зарагдсан зарыг өөрчлөх боломжгүй'; end if;
  if a.status in ('rejected','pending') and not public.is_admin() then raise exception 'Энэ зарыг админ шийдвэрлэнэ'; end if;
  if p_status not in ('active','hidden','sold') then raise exception 'Буруу төлөв'; end if;
  if p_status = 'sold' then
    update public.ads set status = 'sold', sold_at = now(), sold_price = coalesce(p_price, price) where id = p_ad;
  elsif p_status = 'active' then
    update public.ads set status = 'active', approved_at = coalesce(approved_at, now()) where id = p_ad;
  else
    update public.ads set status = 'hidden' where id = p_ad;
  end if;
  perform public.log_action('Авто худалдаа: ' || a.brand || ' ' || a.model || ' → ' || p_status, a.id);
end $$;

-- ---------- 5. Гэрээ: спам хязгаар, PDF солих боломжгүй ----------
create or replace function public.sign_contract(
  p_full_name text, p_phone text, p_brand text, p_model text, p_year int,
  p_plate text, p_vin text, p_price bigint, p_signature text, p_ua text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.settings; pr public.profiles; cid uuid;
begin
  select * into pr from public.profiles where id = auth.uid();
  if pr.id is null then raise exception 'Нэвтрээгүй байна'; end if;
  if pr.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Овог нэрээ оруулна уу'; end if;
  if coalesce(length(p_signature), 0) < 20 then raise exception 'Гарын үсгээ зурна уу'; end if;
  if length(p_signature) > 60000 then raise exception 'Гарын үсэг хэт урт байна, дахин зурна уу'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Үнэ буруу байна'; end if;
  if (select count(*) from public.contracts c where c.user_id = auth.uid() and c.signed_at > now() - interval '1 day') >= 20 then
    raise exception 'Өнөөдөр хэт олон гэрээ байгуулсан байна. Маргааш дахин оролдоно уу.';
  end if;
  select * into s from public.settings where id = 1;
  insert into public.contracts(user_id, company_name, terms, full_name, phone, brand, model, year_made,
                               plate_number, vin, price, signature_svg, user_agent)
  values (auth.uid(), s.company_name, jsonb_build_object('tiers', s.commission_tiers, 'after', s.commission_after),
          left(trim(p_full_name), 120), left(trim(p_phone), 30), left(trim(p_brand), 60), left(trim(p_model), 80), p_year,
          upper(trim(p_plate)), upper(trim(p_vin)), p_price, p_signature, left(p_ua, 200))
  returning id into cid;
  return cid;
end $$;

-- PDF-ийн зам тогтмол (<user_id>/<id>.pdf), нэг л удаа
create or replace function public.set_contract_pdf(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.contracts set pdf_path = user_id::text || '/' || id::text || '.pdf'
  where id = p_id and pdf_path is null and (user_id = auth.uid() or public.is_staff())
    and p_path = user_id::text || '/' || id::text || '.pdf';
end $$;
drop policy if exists "contracts update" on storage.objects;
create policy "contracts update" on storage.objects for update to authenticated
  using (bucket_id = 'contracts' and public.is_staff()) with check (bucket_id = 'contracts' and public.is_staff());

-- Шимтгэлийн тооцоо: зөвхөн ажилтан эсвэл зарын эзэн
create or replace function public.commission_for(p_ad uuid, p_sold_at timestamptz default now())
returns table(days int, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare a public.ads; t jsonb; aft numeric; hrs numeric; e jsonb;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if not (public.is_staff() or a.user_id = auth.uid()) then raise exception 'Эрх хүрэхгүй'; end if;
  select c.terms->'tiers', (c.terms->>'after')::numeric into t, aft from public.contracts c where c.id = a.contract_id;
  if t is null then
    select s.commission_tiers, s.commission_after into t, aft from public.settings s where s.id = 1;
  end if;
  hrs := greatest(0, extract(epoch from (p_sold_at - coalesce(a.approved_at, a.created_at))) / 3600);
  days := greatest(1, ceil(hrs / 24))::int;
  percent := coalesce(aft, 0);
  for e in select x from jsonb_array_elements(t) x order by (x->>'days')::int loop
    if hrs <= (e->>'days')::numeric * 24 then
      percent := (e->>'percent')::numeric;
      exit;
    end if;
  end loop;
  return next;
end $$;

-- ---------- 6. Push токен ажилтанд харагдахгүй ----------
drop policy if exists push_staff_read on public.push_tokens;

-- ---------- 7. Зарын зургийн сан: бусдын файлын жагсаалт харагдахгүй ----------
-- (Нийтийн холбоосоор зураг харагдсаар байна)
drop policy if exists "ad photos read" on storage.objects;
drop policy if exists "ad photos read own" on storage.objects;
create policy "ad photos read own" on storage.objects for select to authenticated
  using (bucket_id = 'ad-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- Хаагдсан хэрэглэгчийн зар нийтэд харагдахгүй
create or replace view public.public_ads as
select
  a.id, a.brand, a.model, a.trim,
  public.mask_plate(a.plate_number) as plate_masked,
  public.mask_vin(a.vin) as vin_masked,
  a.phone, a.year_made, a.year_imported, a.options, a.modifications, a.description,
  a.price, a.photos, a.category, a.status, a.views, a.approved_at, a.created_at,
  a.user_id,
  split_part(coalesce(p.full_name, 'Хэрэглэгч'), ' ', 1) as seller_name,
  p.city as seller_city,
  (select count(*) from public.ads x where x.user_id = a.user_id and x.status in ('active','sold'))::int as seller_ad_count,
  case when p.role = 'dealer' then coalesce(p.shop_name, 'Авто худалдаа') end as seller_shop
from public.ads a
join public.profiles p on p.id = a.user_id
where a.status = 'active' and not p.is_blocked;
grant select on public.public_ads to anon, authenticated;

-- ---------- 8. Вэб push: зөвхөн өгөгдлийн сангаас (нууц түлхүүртэй) ----------
-- Түлхүүрийг Vault-д 'push_secret' нэрээр хадгална (репод бичихгүй):
--   select vault.create_secret('<санамсаргүй урт мөр>', 'push_secret');
-- Мөн Vercel-д PUSH_SECRET орчны хувьсагч ижил утгатай.
create or replace function public.push_secret() returns text
language plpgsql stable security definer set search_path = public as $$
declare s text;
begin
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''push_secret'' limit 1' into s;
  exception when others then s := null;
  end;
  return s;
end $$;

drop function if exists public.prune_web_push(text[]);
create or replace function public.prune_web_push(p_endpoints text[], p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare s text := public.push_secret();
begin
  if s is null or p_secret is distinct from s then raise exception 'Эрх хүрэхгүй'; end if;
  delete from public.web_push_subs where endpoint = any(p_endpoints);
end $$;

create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare msgs jsonb; wmsgs jsonb; chunk jsonb; i int; n int; sec text := public.push_secret();
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', r.title, 'body', coalesce(r.body, ''), 'sound', 'default', 'priority', 'high',
           'channelId', 'default', 'data', jsonb_build_object('adId', r.ad_id, 'type', r.type, 'id', r.id))), '[]'::jsonb)
    into msgs
  from new_rows r join public.push_tokens t on t.user_id = r.user_id;
  i := 0; n := jsonb_array_length(msgs);
  while i < n loop
    select jsonb_agg(x.e order by x.k) into chunk from jsonb_array_elements(msgs) with ordinality as x(e, k) where x.k > i and x.k <= i + 100;
    begin
      perform net.http_post(url := 'https://exp.host/--/api/v2/push/send', body := chunk,
        headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb);
    exception when others then null;
    end;
    i := i + 100;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'sub', jsonb_build_object('endpoint', w.endpoint, 'keys', jsonb_build_object('p256dh', w.p256dh, 'auth', w.auth)),
           'title', r.title, 'body', coalesce(r.body, ''), 'tag', r.type || coalesce('-' || r.ad_id::text, ''),
           'url', case
                    when r.type = 'sale_report' then '/admin/reports'
                    when r.type = 'report_reviewed' then '/manager/reports'
                    when r.type = 'loan_request' then '/leasing'
                    when r.type = 'loan_update' then '/loans'
                    when r.ad_id is null then '/notifications'
                    when r.type = 'staff_new_ad' then '/manager/ads?id=' || r.ad_id
                    else '/ads/' || r.ad_id
                  end)), '[]'::jsonb)
    into wmsgs
  from new_rows r join public.web_push_subs w on w.user_id = r.user_id;
  i := 0; n := jsonb_array_length(wmsgs);
  while i < n loop
    select jsonb_agg(x.e order by x.k) into chunk from jsonb_array_elements(wmsgs) with ordinality as x(e, k) where x.k > i and x.k <= i + 200;
    begin
      perform net.http_post(url := 'https://web-mu-fawn-45.vercel.app/api/push/web', body := jsonb_build_object('messages', chunk),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', coalesce(sec, '')), timeout_milliseconds := 30000);
    exception when others then null;
    end;
    i := i + 200;
  end loop;
  return null;
end $$;

-- ---------- 9. Лизингийн хүсэлтийн үйл явдлын бүртгэл ----------
create table if not exists public.loan_events (
  id bigserial primary key,
  request_id uuid not null references public.loan_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  kind text not null check (kind in ('submitted','status','doc_view','cancelled')),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists loan_events_req_idx on public.loan_events(request_id, created_at);
alter table public.loan_events enable row level security;
drop policy if exists loan_events_read on public.loan_events;
create policy loan_events_read on public.loan_events for select using (
  public.is_admin()
  or exists (select 1 from public.loan_requests r where r.id = loan_events.request_id and r.partner_id = public.my_partner())
);
grant select on public.loan_events to authenticated;

create or replace function public.actor_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), email) || case role when 'admin' then ' (админ)' when 'leasing' then '' else '' end
  from public.profiles where id = auth.uid()
$$;

create or replace function public.submit_loan_request(
  p_ad uuid, p_partner uuid, p_down bigint, p_term int, p_app jsonb, p_docs jsonb, p_consent boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.ads; lp public.leasing_partners; me public.profiles; rid uuid; m bigint;
  v_name text := left(trim(coalesce(p_app->>'full_name', '')), 80);
  v_phone text := left(trim(coalesce(p_app->>'phone', '')), 30);
  v_rd text := upper(regexp_replace(coalesce(p_app->>'register_no', ''), '\s', '', 'g'));
  v_birth date; v_age int;
  v_emp text := coalesce(p_app->>'employment_type', '');
  v_work int; v_income bigint; v_other bigint; v_debt bigint; v_overdue boolean;
  v_cos jsonb := case when jsonb_typeof(p_app->'cosigner') = 'object' then p_app->'cosigner' end;
  v_cos_income bigint := 0;
  v_app jsonb; v_docs jsonb := '{}'::jsonb; v_checks jsonb := '[]'::jsonb;
  v_dti numeric; v_loan bigint; k text; pth text; ok boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Нэвтэрнэ үү'; end if;
  if me.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if not coalesce(p_consent, false) then raise exception 'Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү'; end if;
  if jsonb_typeof(p_app) is distinct from 'object' then raise exception 'Анкетаа бөглөнө үү'; end if;

  select * into a from public.ads where id = p_ad and status = 'active';
  if a.id is null then raise exception 'Зар идэвхтэй биш байна'; end if;
  if a.user_id = auth.uid() then raise exception 'Өөрийн зарт хүсэлт илгээх боломжгүй'; end if;
  select * into lp from public.leasing_partners where id = p_partner and active;
  if lp.id is null then raise exception 'Лизингийн компани олдсонгүй'; end if;
  if p_term is null or p_term < 1 or p_term > lp.max_term_months then raise exception 'Хугацаа % сараас хэтрэхгүй', lp.max_term_months; end if;
  if p_down is null or p_down < 0 or p_down >= a.price then raise exception 'Урьдчилгаа буруу байна'; end if;
  if p_down < ceil(a.price * lp.min_down_pct / 100) then
    raise exception 'Урьдчилгаа хамгийн багадаа үнийн % хувь байна', trim_scale(lp.min_down_pct);
  end if;
  if (select count(*) from public.loan_requests r where r.user_id = auth.uid() and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Нэг өдөрт 5-аас олон хүсэлт илгээх боломжгүй. Маргааш дахин оролдоно уу.';
  end if;
  if exists (select 1 from public.loan_requests r where r.user_id = auth.uid() and r.ad_id = p_ad and r.partner_id = p_partner and r.status in ('new','contacted')) then
    raise exception 'Энэ зарт хүсэлт аль хэдийн илгээсэн байна';
  end if;

  -- Анкет шалгах
  if v_name = '' then raise exception 'Овог нэрээ оруулна уу'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then raise exception 'Утасны дугаараа зөв оруулна уу'; end if;
  v_birth := public.rd_birth_date(v_rd);
  if v_birth is null or v_birth > current_date then raise exception 'Регистрийн дугаар буруу байна (жишээ: УБ99112233)'; end if;
  v_age := extract(year from age(current_date, v_birth))::int;
  if coalesce(trim(p_app->>'city'), '') = '' or coalesce(trim(p_app->>'address'), '') = '' then raise exception 'Оршин суугаа хаягаа бөглөнө үү'; end if;
  if coalesce(p_app->>'marital_status', '') not in ('single','married','divorced','widowed') then raise exception 'Гэрлэлтийн байдлаа сонгоно уу'; end if;
  if coalesce(p_app->>'household_size', '') !~ '^[0-9]{1,2}$' or (p_app->>'household_size')::int not between 1 and 30 then raise exception 'Ам бүлийн тоогоо оруулна уу'; end if;
  if v_emp not in ('salary','business','both','pension','other') then raise exception 'Орлогын эх үүсвэрээ сонгоно уу'; end if;
  if v_emp in ('salary','both') and coalesce(trim(p_app->>'employer'), '') = '' then raise exception 'Ажлын газраа оруулна уу'; end if;
  if coalesce(p_app->>'work_months', '') !~ '^[0-9]{1,3}$' then raise exception 'Ажилласан / бизнес эрхэлсэн хугацаагаа (сараар) оруулна уу'; end if;
  v_work := (p_app->>'work_months')::int;
  if coalesce(p_app->>'monthly_income', '') !~ '^[0-9]{1,12}$' or (p_app->>'monthly_income')::bigint <= 0 then raise exception 'Сарын орлогоо оруулна уу'; end if;
  v_income := (p_app->>'monthly_income')::bigint;
  v_other := case when coalesce(p_app->>'other_income', '') ~ '^[0-9]{1,12}$' then (p_app->>'other_income')::bigint else 0 end;
  v_debt := case when coalesce(p_app->>'existing_debt_payment', '') ~ '^[0-9]{1,12}$' then (p_app->>'existing_debt_payment')::bigint else 0 end;
  if jsonb_typeof(p_app->'has_overdue') is distinct from 'boolean' then raise exception 'Хугацаа хэтэрсэн зээлтэй эсэхээ сонгоно уу'; end if;
  v_overdue := (p_app->>'has_overdue')::boolean;
  if coalesce(trim(p_app->>'ref_name'), '') = '' or length(regexp_replace(coalesce(p_app->>'ref_phone', ''), '\D', '', 'g')) < 8 then
    raise exception 'Яаралтай үед холбоо барих хүний нэр, утсыг оруулна уу';
  end if;
  if v_cos is not null then
    if coalesce(trim(v_cos->>'name'), '') = '' or length(regexp_replace(coalesce(v_cos->>'phone', ''), '\D', '', 'g')) < 8 then
      raise exception 'Хамтран зээлдэгчийн нэр, утсыг оруулна уу';
    end if;
    v_cos_income := case when coalesce(v_cos->>'monthly_income', '') ~ '^[0-9]{1,12}$' then (v_cos->>'monthly_income')::bigint else 0 end;
  end if;

  -- Баримт: зөвхөн өөрийн хавтаснаас, байгаа файл
  if jsonb_typeof(p_docs) = 'object' then
    for k, pth in select key, value from jsonb_each_text(p_docs) loop
      if regexp_replace(k, '_[2-5]$', '') = any(public.loan_doc_kinds()) and pth like auth.uid()::text || '/%' and pth not like '%..%'
         and exists (select 1 from storage.objects o where o.bucket_id = 'loan-docs' and o.name = pth) then
        v_docs := v_docs || jsonb_build_object(k, pth);
      end if;
    end loop;
  end if;
  foreach k in array lp.required_docs loop
    if k = 'cosigner_id' and v_cos is null then continue; end if;
    if not v_docs ? k then raise exception 'Шаардлагатай баримт дутуу байна: %', k using hint = 'doc:' || k; end if;
  end loop;

  m := public.loan_monthly(a.price - p_down, lp.rate_annual, p_term);
  v_loan := a.price - p_down;
  v_dti := round((v_debt + m)::numeric * 100 / nullif(v_income + v_other + v_cos_income, 0), 2);

  -- Шаардлагын шалгалт (хаахгүй, зөвхөн тэмдэглэнэ)
  v_checks := jsonb_build_array(
    jsonb_build_object('key','age','label','Нас ' || lp.min_age || '–' || lp.max_age, 'value', v_age || ' нас', 'ok', v_age between lp.min_age and lp.max_age),
    jsonb_build_object('key','work','label',
      case when v_emp = 'business' then 'Бизнес эрхэлсэн ' || lp.min_business_months || '+ сар' else 'Ажилласан ' || lp.min_work_months || '+ сар' end,
      'value', v_work || ' сар',
      'ok', case when v_emp in ('pension','other') then null
                 when v_emp = 'business' then v_work >= lp.min_business_months
                 else v_work >= lp.min_work_months end),
    jsonb_build_object('key','dti','label','Өр/орлогын харьцаа ≤ ' || trim_scale(lp.max_dti) || '%', 'value', coalesce(trim_scale(v_dti)::text, '—') || '%', 'ok', v_dti is not null and v_dti <= lp.max_dti),
    jsonb_build_object('key','overdue','label','Хугацаа хэтэрсэн зээлгүй', 'value', case when v_overdue then 'Байгаа' else 'Байхгүй' end, 'ok', not v_overdue)
  );
  if lp.min_car_year is not null then
    v_checks := v_checks || jsonb_build_object('key','car','label','Машин ' || lp.min_car_year || ' оноос хойш', 'value', a.year_made || ' он', 'ok', a.year_made >= lp.min_car_year);
  end if;
  if lp.cosigner_over is not null and v_loan > lp.cosigner_over then
    v_checks := v_checks || jsonb_build_object('key','cosigner','label','Хамтран зээлдэгчтэй (' || to_char(lp.cosigner_over, 'FM999,999,999,999') || '₮-өөс дээш зээлд)', 'value', case when v_cos is null then 'Байхгүй' else 'Байгаа' end, 'ok', v_cos is not null);
  end if;
  select coalesce(bool_and((c->>'ok')::boolean), true) into ok from jsonb_array_elements(v_checks) c where c->>'ok' is not null;

  v_app := jsonb_strip_nulls(jsonb_build_object(
    'register_no', v_rd, 'birth_date', v_birth, 'age', v_age,
    'city', trim(p_app->>'city'), 'district', nullif(trim(p_app->>'district'), ''), 'address', left(trim(p_app->>'address'), 300),
    'marital_status', p_app->>'marital_status', 'household_size', (p_app->>'household_size')::int,
    'employment_type', v_emp, 'employer', nullif(trim(p_app->>'employer'), ''), 'position', nullif(trim(p_app->>'position'), ''),
    'work_months', v_work, 'monthly_income', v_income, 'other_income', v_other, 'existing_debt_payment', v_debt,
    'has_overdue', v_overdue, 'has_license', case when jsonb_typeof(p_app->'has_license') = 'boolean' then (p_app->>'has_license')::boolean end,
    'ref_name', trim(p_app->>'ref_name'), 'ref_phone', trim(p_app->>'ref_phone'), 'ref_relation', nullif(trim(p_app->>'ref_relation'), ''),
    'cosigner', case when v_cos is null then null else jsonb_strip_nulls(jsonb_build_object(
      'name', trim(v_cos->>'name'), 'phone', trim(v_cos->>'phone'), 'relation', nullif(trim(v_cos->>'relation'), ''),
      'register_no', nullif(upper(regexp_replace(coalesce(v_cos->>'register_no', ''), '\s', '', 'g')), ''), 'monthly_income', v_cos_income)) end
  ));

  insert into public.loan_requests(ad_id, user_id, partner_id, full_name, phone, car, price, down_payment, term_months,
                                   rate_annual, monthly_payment, income, note, consent, applicant, docs, checks, checks_ok, dti)
  values (a.id, auth.uid(), lp.id, v_name, v_phone, a.brand || ' ' || a.model || ' · ' || a.year_made,
          a.price, p_down, p_term, lp.rate_annual, m, to_char(v_income, 'FM999,999,999,999') || '₮', nullif(left(trim(p_app->>'note'), 1000), ''), true,
          v_app, v_docs, v_checks, ok, v_dti)
  returning id into rid;

  insert into public.loan_events(request_id, actor_id, actor_name, kind, detail)
  values (rid, auth.uid(), v_name, 'submitted', lp.name || ' · ' || jsonb_array_length(v_checks) || ' шалгалт, ' || (select count(*) from jsonb_object_keys(v_docs)) || ' баримт');

  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'loan_request', 'Лизингийн шинэ хүсэлт' || case when ok then ' ✓' else '' end,
         v_name || ' · ' || a.brand || ' ' || a.model || ' · ' || to_char(v_loan, 'FM999,999,999,999') || '₮, ' || p_term || ' сар',
         a.id
  from public.profiles p
  where not p.is_blocked and ((p.role = 'leasing' and p.partner_id = lp.id) or p.role = 'admin');
  perform public.log_action('Лизингийн хүсэлт: ' || a.brand || ' ' || a.model || ' → ' || lp.name, a.id);
  return rid;
end $$;

create or replace function public.cancel_loan_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.loan_requests set status = 'cancelled', updated_at = now()
  where id = p_id and user_id = auth.uid() and status in ('new','contacted');
  if not found then raise exception 'Хүсэлт олдсонгүй эсвэл цуцлах боломжгүй'; end if;
  insert into public.loan_events(request_id, actor_id, actor_name, kind, detail) values (p_id, auth.uid(), public.actor_name(), 'cancelled', 'Худалдан авагч цуцалсан');
end $$;

create or replace function public.update_loan_request(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loan_requests; lp public.leasing_partners; v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  select * into r from public.loan_requests where id = p_id;
  if r.id is null then raise exception 'Хүсэлт олдсонгүй'; end if;
  if not (public.is_admin() or coalesce(r.partner_id = public.my_partner(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if p_status not in ('new','contacted','approved','rejected') then raise exception 'Буруу төлөв'; end if;
  if r.status = 'cancelled' then raise exception 'Худалдан авагч хүсэлтээ цуцалсан байна'; end if;
  update public.loan_requests set status = p_status, partner_note = coalesce(v_note, partner_note), updated_at = now()
  where id = p_id;
  insert into public.loan_events(request_id, actor_id, actor_name, kind, detail)
  values (p_id, auth.uid(), public.actor_name(), 'status', r.status || ' → ' || p_status || coalesce(': ' || v_note, ''));
  select * into lp from public.leasing_partners where id = r.partner_id;
  if p_status <> r.status and p_status in ('contacted','approved','rejected') then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (r.user_id, 'loan_update',
            case p_status when 'contacted' then 'Лизингийн компани холбогдоно'
                          when 'approved' then 'Лизингийн хүсэлт зөвшөөрөгдлөө'
                          else 'Лизингийн хүсэлт татгалзагдлаа' end,
            lp.name || ' · ' || r.car || coalesce(' · ' || v_note, ''), r.ad_id);
  end if;
end $$;

-- Баримт нээх: эрх шалгаж, хэн хэзээ нээснийг бүртгээд файлын замыг буцаана.
-- (Дараа нь клиент 2 минутын түр холбоос үүсгэнэ — storage RLS дахин шалгана)
create or replace function public.loan_doc_open(p_request uuid, p_key text) returns text
language plpgsql security definer set search_path = public as $$
declare r public.loan_requests; pth text;
begin
  select * into r from public.loan_requests where id = p_request;
  if r.id is null then raise exception 'Хүсэлт олдсонгүй'; end if;
  if not (public.is_admin() or (coalesce(r.partner_id = public.my_partner(), false) and r.status <> 'cancelled')) then
    raise exception 'Эрх хүрэхгүй';
  end if;
  pth := r.docs->>p_key;
  if pth is null then raise exception 'Баримт олдсонгүй'; end if;
  insert into public.loan_events(request_id, actor_id, actor_name, kind, detail) values (p_request, auth.uid(), public.actor_name(), 'doc_view', p_key);
  return pth;
end $$;

-- Баримтын сан: цуцлагдсан хүсэлтийн баримтыг компани харахгүй; илгээсэн баримтыг устгаж/солих боломжгүй
drop policy if exists "loan docs read" on storage.objects;
create policy "loan docs read" on storage.objects for select to authenticated
  using (bucket_id = 'loan-docs' and (
    (storage.foldername(objects.name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.loan_requests r, jsonb_each_text(r.docs) d
               where r.partner_id = public.my_partner() and r.status <> 'cancelled' and d.value = objects.name)
  ));
drop policy if exists "loan docs delete" on storage.objects;
create policy "loan docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'loan-docs' and (storage.foldername(objects.name))[1] = auth.uid()::text
         and not exists (select 1 from public.loan_requests r, jsonb_each_text(r.docs) d
                         where d.value = objects.name and r.status <> 'cancelled'));

-- ---------- 10. Функцийн эрх (Security Advisor) ----------
-- Бүх SECURITY DEFINER функцээс нийтийн эрхийг хасаад, нэвтэрсэн хэрэглэгчид өгнө.
-- Trigger функц, дотоод функцуудыг хэн ч шууд дуудахгүй.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname, pg_get_function_result(p.oid) as res
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.res = 'trigger' or f.proname in ('log_action','push_targets','apply_staff_invite','push_secret','email_verified') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
-- RLS бодлогод ашиглагддаг туслах функц, нийтийн хуудасны үзэлтийн тоо, вэб push цэвэрлэгээ
grant execute on function public.is_admin(), public.is_staff(), public.my_role(), public.my_partner() to anon;
grant execute on function public.increment_view(uuid) to anon;
grant execute on function public.prune_web_push(text[], text) to anon;
alter default privileges in schema public revoke execute on functions from public;

notify pgrst, 'reload schema';
