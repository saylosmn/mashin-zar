-- =====================================================================
-- ЗАСВАР 08: Лизингийн түншлэл
--   * leasing_partners: лизингийн компаниуд (хүү, урьдчилгаа, хугацаа, туршилтын хугацаа)
--   * "leasing" эрх: түншийн ажилтан өөрийн компанийн хүсэлтүүдийг удирдана
--   * loan_requests: худалдан авагчийн "Лизингээр авах" хүсэлт (зөвшөөрөлтэй)
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

-- ---------- Түнш компаниуд ----------
create table if not exists public.leasing_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  rate_annual numeric(5,2) not null default 24,     -- жилийн хүү, %
  min_down_pct numeric(5,2) not null default 30,    -- хамгийн бага урьдчилгаа, %
  max_term_months int not null default 36,          -- хамгийн урт хугацаа, сар
  trial_until date,                                 -- туршилтын (үнэгүй) хугацаа
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lp_rate check (rate_annual >= 0 and rate_annual <= 100),
  constraint lp_down check (min_down_pct >= 0 and min_down_pct < 100),
  constraint lp_term check (max_term_months between 1 and 120)
);
alter table public.leasing_partners enable row level security;
drop policy if exists partners_read on public.leasing_partners;
create policy partners_read on public.leasing_partners for select using (true);
grant select on public.leasing_partners to anon, authenticated;

-- ---------- Эрх ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','manager','admin','dealer','leasing'));
alter table public.profiles add column if not exists partner_id uuid references public.leasing_partners(id) on delete set null;

alter table public.staff_invites drop constraint if exists staff_invites_role_check;
alter table public.staff_invites add constraint staff_invites_role_check check (role in ('manager','admin','dealer','leasing'));
alter table public.staff_invites add column if not exists partner_id uuid references public.leasing_partners(id) on delete cascade;

create or replace function public.my_partner() returns uuid
language sql stable security definer set search_path = public as $$
  select partner_id from public.profiles where id = auth.uid() and role = 'leasing' and not is_blocked
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.staff_invites;
begin
  select * into inv from public.staff_invites where lower(email) = lower(new.email);
  insert into public.profiles (id, email, full_name, avatar_url, role, phone, shop_name, partner_id)
  values (
    new.id,
    new.email,
    coalesce(inv.full_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(inv.role, 'user'),
    inv.phone,
    inv.shop_name,
    inv.partner_id
  )
  on conflict (id) do nothing;
  insert into public.activity_log(actor_id, action) values (new.id, 'Шинэ хэрэглэгч бүртгүүлэв: ' || coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

-- ---------- Лизингийн хүсэлт ----------
create table if not exists public.loan_requests (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid references public.ads(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.leasing_partners(id) on delete cascade,
  full_name text not null,
  phone text not null,
  car text not null,                  -- "Toyota Prius · 2018" (зар устсан ч харагдана)
  price bigint not null,
  down_payment bigint not null,
  term_months int not null,
  rate_annual numeric(5,2) not null,
  monthly_payment bigint not null,
  income text,
  note text,
  consent boolean not null,
  status text not null default 'new' check (status in ('new','contacted','approved','rejected','cancelled')),
  partner_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loan_requests_partner_idx on public.loan_requests(partner_id, created_at desc);
create index if not exists loan_requests_user_idx on public.loan_requests(user_id, created_at desc);
alter table public.loan_requests enable row level security;
drop policy if exists loans_read on public.loan_requests;
create policy loans_read on public.loan_requests for select using (
  user_id = auth.uid() or partner_id = public.my_partner() or public.is_admin()
);
grant select on public.loan_requests to authenticated;

-- Сарын төлбөр (аннуитет)
create or replace function public.loan_monthly(p_principal numeric, p_rate_annual numeric, p_months int) returns bigint
language sql immutable as $$
  select case
    when p_principal <= 0 then 0
    when coalesce(p_rate_annual, 0) = 0 then round(p_principal / p_months)
    else round(p_principal * (p_rate_annual / 1200) / (1 - power(1 + p_rate_annual / 1200, -p_months)))
  end::bigint
$$;

-- Худалдан авагч: хүсэлт илгээх
create or replace function public.submit_loan_request(
  p_ad uuid, p_partner uuid, p_full_name text, p_phone text, p_down bigint, p_term int,
  p_income text default null, p_note text default null, p_consent boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; lp public.leasing_partners; me public.profiles; rid uuid; m bigint;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Нэвтэрнэ үү'; end if;
  if me.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if not coalesce(p_consent, false) then raise exception 'Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Нэрээ оруулна уу'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 8 then raise exception 'Утасны дугаараа зөв оруулна уу'; end if;
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
  if exists (select 1 from public.loan_requests r where r.user_id = auth.uid() and r.ad_id = p_ad and r.partner_id = p_partner and r.status in ('new','contacted')) then
    raise exception 'Энэ зарт хүсэлт аль хэдийн илгээсэн байна';
  end if;
  m := public.loan_monthly(a.price - p_down, lp.rate_annual, p_term);
  insert into public.loan_requests(ad_id, user_id, partner_id, full_name, phone, car, price, down_payment, term_months,
                                   rate_annual, monthly_payment, income, note, consent)
  values (a.id, auth.uid(), lp.id, trim(p_full_name), trim(p_phone), a.brand || ' ' || a.model || ' · ' || a.year_made,
          a.price, p_down, p_term, lp.rate_annual, m, nullif(trim(p_income), ''), nullif(trim(p_note), ''), true)
  returning id into rid;
  -- Түншийн ажилтнууд, админд мэдэгдэл
  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'loan_request', 'Лизингийн шинэ хүсэлт',
         trim(p_full_name) || ' · ' || a.brand || ' ' || a.model || ' · ' || to_char(a.price - p_down, 'FM999,999,999,999') || '₮, ' || p_term || ' сар',
         a.id
  from public.profiles p
  where not p.is_blocked and ((p.role = 'leasing' and p.partner_id = lp.id) or p.role = 'admin');
  perform public.log_action('Лизингийн хүсэлт: ' || a.brand || ' ' || a.model || ' → ' || lp.name, a.id);
  return rid;
end $$;

-- Худалдан авагч: хүсэлтээ цуцлах
create or replace function public.cancel_loan_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.loan_requests set status = 'cancelled', updated_at = now()
  where id = p_id and user_id = auth.uid() and status in ('new','contacted');
  if not found then raise exception 'Хүсэлт олдсонгүй эсвэл цуцлах боломжгүй'; end if;
end $$;

-- Түншийн ажилтан: төлөв өөрчлөх
create or replace function public.update_loan_request(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.loan_requests; lp public.leasing_partners;
begin
  select * into r from public.loan_requests where id = p_id;
  if r.id is null then raise exception 'Хүсэлт олдсонгүй'; end if;
  if not (public.is_admin() or coalesce(r.partner_id = public.my_partner(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if p_status not in ('new','contacted','approved','rejected') then raise exception 'Буруу төлөв'; end if;
  if r.status = 'cancelled' then raise exception 'Худалдан авагч хүсэлтээ цуцалсан байна'; end if;
  update public.loan_requests set status = p_status, partner_note = coalesce(nullif(trim(p_note), ''), partner_note), updated_at = now()
  where id = p_id;
  select * into lp from public.leasing_partners where id = r.partner_id;
  if p_status <> r.status and p_status in ('contacted','approved','rejected') then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (r.user_id, 'loan_update',
            case p_status when 'contacted' then 'Лизингийн компани холбогдоно'
                          when 'approved' then 'Лизингийн хүсэлт зөвшөөрөгдлөө'
                          else 'Лизингийн хүсэлт татгалзагдлаа' end,
            lp.name || ' · ' || r.car || coalesce(' · ' || nullif(trim(p_note), ''), ''), r.ad_id);
  end if;
end $$;

-- Түншийн ажилтан: өөрийн нөхцөл (хүү, урьдчилгаа, хугацаа)
create or replace function public.set_partner_terms(p_rate numeric, p_min_down numeric, p_max_term int) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid := public.my_partner();
begin
  if pid is null then raise exception 'Эрх хүрэхгүй'; end if;
  update public.leasing_partners set rate_annual = p_rate, min_down_pct = p_min_down, max_term_months = p_max_term, updated_at = now()
  where id = pid;
end $$;

-- ---------- Админ ----------
create or replace function public.upsert_partner(
  p_id uuid, p_name text, p_phone text, p_rate numeric, p_min_down numeric, p_max_term int, p_trial_until date, p_active boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Компанийн нэр оруулна уу'; end if;
  if p_id is null then
    insert into public.leasing_partners(name, phone, rate_annual, min_down_pct, max_term_months, trial_until, active)
    values (trim(p_name), nullif(trim(p_phone), ''), coalesce(p_rate, 24), coalesce(p_min_down, 30), coalesce(p_max_term, 36), p_trial_until, coalesce(p_active, true))
    returning id into pid;
  else
    update public.leasing_partners set name = trim(p_name), phone = nullif(trim(p_phone), ''), rate_annual = coalesce(p_rate, rate_annual),
      min_down_pct = coalesce(p_min_down, min_down_pct), max_term_months = coalesce(p_max_term, max_term_months),
      trial_until = p_trial_until, active = coalesce(p_active, active), updated_at = now()
    where id = p_id returning id into pid;
    if pid is null then raise exception 'Компани олдсонгүй'; end if;
  end if;
  perform public.log_action('Лизингийн түнш: ' || trim(p_name));
  return pid;
end $$;

create or replace function public.invite_leasing_staff(p_email text, p_partner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if e !~ '^\S+@\S+\.\S+$' then raise exception 'И-мэйл буруу байна'; end if;
  if not exists (select 1 from public.leasing_partners where id = p_partner) then raise exception 'Компани олдсонгүй'; end if;
  if exists (select 1 from public.profiles where lower(email) = e and role in ('manager','admin')) then
    raise exception 'Энэ хүн менежер/админ эрхтэй байна';
  end if;
  insert into public.staff_invites(email, role, partner_id) values (e, 'leasing', p_partner)
  on conflict (email) do update set role = 'leasing', partner_id = excluded.partner_id, shop_name = null;
  update public.profiles set role = 'leasing', partner_id = p_partner, is_blocked = false where lower(email) = e;
  perform public.log_action('Админ: ' || e || ' → лизингийн ажилтан');
end $$;

create or replace function public.remove_leasing_staff(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.profiles set role = 'user', partner_id = null where id = p_user and role = 'leasing' returning * into pr;
  if pr.id is null then raise exception 'Лизингийн ажилтан олдсонгүй'; end if;
  delete from public.staff_invites where lower(email) = lower(pr.email) and role = 'leasing';
end $$;

-- ---------- Эрх (GRANT) ----------
revoke execute on function public.submit_loan_request(uuid, uuid, text, text, bigint, int, text, text, boolean) from public, anon;
revoke execute on function public.cancel_loan_request(uuid) from public, anon;
revoke execute on function public.update_loan_request(uuid, text, text) from public, anon;
revoke execute on function public.set_partner_terms(numeric, numeric, int) from public, anon;
revoke execute on function public.upsert_partner(uuid, text, text, numeric, numeric, int, date, boolean) from public, anon;
revoke execute on function public.invite_leasing_staff(text, uuid) from public, anon;
revoke execute on function public.remove_leasing_staff(uuid) from public, anon;
grant execute on function public.submit_loan_request(uuid, uuid, text, text, bigint, int, text, text, boolean) to authenticated;
grant execute on function public.cancel_loan_request(uuid) to authenticated;
grant execute on function public.update_loan_request(uuid, text, text) to authenticated;
grant execute on function public.set_partner_terms(numeric, numeric, int) to authenticated;
grant execute on function public.upsert_partner(uuid, text, text, numeric, numeric, int, date, boolean) to authenticated;
grant execute on function public.invite_leasing_staff(text, uuid) to authenticated;
grant execute on function public.remove_leasing_staff(uuid) to authenticated;
grant execute on function public.loan_monthly(numeric, numeric, int) to anon, authenticated;

-- ---------- Засвар: авто худалдааны эрхийн шалгалт (хаагдсан хэрэглэгч, NULL) ----------
create or replace function public.dealer_update_ad(p_ad uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if not (public.is_admin() or coalesce(public.my_role() = 'dealer' and a.user_id = auth.uid(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if a.status = 'sold' then raise exception 'Зарагдсан зарыг засах боломжгүй'; end if;
  if p ? 'price' and coalesce((p->>'price')::bigint, 0) <= 0 then raise exception 'Үнэ буруу'; end if;
  if p ? 'photos' and (jsonb_typeof(p->'photos') <> 'array' or jsonb_array_length(p->'photos') = 0 or jsonb_array_length(p->'photos') > 16) then
    raise exception 'Зураг 1-16 байна';
  end if;
  update public.ads set
    brand = coalesce(nullif(trim(p->>'brand'), ''), brand),
    model = coalesce(nullif(trim(p->>'model'), ''), model),
    trim = case when p ? 'trim' then nullif(trim(p->>'trim'), '') else trim end,
    year_made = coalesce((p->>'year_made')::int, year_made),
    year_imported = case when p ? 'year_imported' then nullif(p->>'year_imported', '')::int else year_imported end,
    plate_number = coalesce(nullif(upper(trim(p->>'plate_number')), ''), plate_number),
    vin = coalesce(nullif(upper(trim(p->>'vin')), ''), vin),
    phone = coalesce(nullif(trim(p->>'phone'), ''), phone),
    options = case when p ? 'options' then array(select jsonb_array_elements_text(p->'options')) else options end,
    modifications = case when p ? 'modifications' then nullif(trim(p->>'modifications'), '') else modifications end,
    description = case when p ? 'description' then nullif(trim(p->>'description'), '') else description end,
    price = coalesce((p->>'price')::bigint, price),
    photos = case when p ? 'photos' then array(select jsonb_array_elements_text(p->'photos')) else photos end
  where id = p_ad;
end $$;

-- Нуух / дахин гаргах / зарагдсан
create or replace function public.dealer_set_status(p_ad uuid, p_status text, p_price bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if not (public.is_admin() or coalesce(public.my_role() = 'dealer' and a.user_id = auth.uid(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if a.status = 'sold' then raise exception 'Зарагдсан зарыг өөрчлөх боломжгүй'; end if;
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

-- ---------- Push холбоос (шинэ мэдэгдлийн төрлүүд) ----------
create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare msgs jsonb; wmsgs jsonb; chunk jsonb; i int; n int;
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
        headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 30000);
    exception when others then null;
    end;
    i := i + 200;
  end loop;
  return null;
end $$;

-- ---------- Шууд шинэчлэл ----------
drop trigger if exists mz_sync_loans on public.loan_requests;
create trigger mz_sync_loans after insert or update or delete on public.loan_requests
for each row execute function public.mz_broadcast();
drop trigger if exists mz_sync_partners on public.leasing_partners;
create trigger mz_sync_partners after insert or update or delete on public.leasing_partners
for each row execute function public.mz_broadcast();

notify pgrst, 'reload schema';
