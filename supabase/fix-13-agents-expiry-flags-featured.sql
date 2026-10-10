-- =====================================================================
-- ЗАСВАР 13: Агент, зарын хугацаа, гомдол, онцлох зар, алдааны бүртгэл
--   1. Агент — зар авчирсан/зарсан агентад шимтгэлийн хувь оноох, төлсөн эсэхийг хянах
--   2. Зарын хугацаа — ad_days хоногийн дараа нийтээс хасагдана, 3 хоногийн өмнө сануулна, сунгана
--   3. Гомдол — хэрэглэгч хуурамч/буруу зарыг мэдээлнэ, менежер шийдвэрлэнэ
--   4. Онцлох (VIP) зар — жагсаалтын эхэнд, тэмдэгтэй; хэрэглэгч хүсэлт илгээж, админ идэвхжүүлнэ
--   5. Алдааны бүртгэл — вэб, сервер, апп-ын алдааг админ хардаг
--   + Сайтын хаяг (site_url) тохиргоонд — домэйн солиход push холбоос шинэчлэгдэнэ
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй. fix-12-ийн дараа.
-- =====================================================================

-- ---------- 0. Тохиргоо ----------
alter table public.settings add column if not exists agent_share numeric(5,2) not null default 50;   -- шимтгэлийн хэдэн % нь агентад
alter table public.settings add column if not exists featured_price bigint not null default 50000;   -- онцлох зарын үнэ (₮)
alter table public.settings add column if not exists featured_days int not null default 7;           -- онцлох хугацаа (хоног)
alter table public.settings add column if not exists site_url text not null default 'https://web-mu-fawn-45.vercel.app';
do $$
begin
  alter table public.settings add constraint settings_agent_share check (agent_share between 0 and 100);
  alter table public.settings add constraint settings_featured check (featured_price >= 0 and featured_days between 1 and 365);
  alter table public.settings add constraint settings_site_url check (site_url ~ '^https://[^/\s]+$');
exception when duplicate_object then null;
end $$;

-- ---------- 1. Агент: эрх, код ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','manager','admin','dealer','leasing','agent'));
alter table public.staff_invites drop constraint if exists staff_invites_role_check;
alter table public.staff_invites add constraint staff_invites_role_check check (role in ('manager','admin','dealer','leasing','agent'));
alter table public.profiles add column if not exists agent_code text;
create unique index if not exists profiles_agent_code_uidx on public.profiles(agent_code) where agent_code is not null;

-- Давхардахгүй 6 тэмдэгтэй код (андуурагдах 0/O, 1/I-гүй)
create or replace function public.new_agent_code() returns text
language plpgsql volatile set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where agent_code = c);
  end loop;
  return c;
end $$;

-- Агент болмогц код автоматаар үүснэ
create or replace function public.profiles_agent_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'agent' and new.agent_code is null then new.agent_code := public.new_agent_code(); end if;
  return new;
end $$;
drop trigger if exists profiles_agent_code on public.profiles;
create trigger profiles_agent_code before insert or update of role on public.profiles
for each row execute function public.profiles_agent_code();

create or replace function public.invite_agent(p_email text, p_name text default null, p_phone text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if e !~ '^\S+@\S+\.\S+$' then raise exception 'И-мэйл буруу байна'; end if;
  if exists (select 1 from public.profiles where lower(email) = e and role in ('manager','admin')) then
    raise exception 'Энэ хүн менежер/админ эрхтэй байна';
  end if;
  insert into public.staff_invites(email, role, full_name, phone, shop_name, partner_id)
  values (e, 'agent', nullif(trim(p_name), ''), nullif(trim(p_phone), ''), null, null)
  on conflict (email) do update set role = 'agent', full_name = coalesce(excluded.full_name, staff_invites.full_name),
    phone = coalesce(excluded.phone, staff_invites.phone), shop_name = null, partner_id = null;
  update public.profiles set role = 'agent', shop_name = null, partner_id = null, is_blocked = false,
    full_name = coalesce(full_name, nullif(trim(p_name), '')), phone = coalesce(phone, nullif(trim(p_phone), ''))
  where lower(email) = e;
  perform public.log_action('Админ: ' || e || ' → агент');
end $$;

create or replace function public.remove_agent(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.profiles set role = 'user' where id = p_user and role = 'agent' returning * into pr;
  if pr.id is null then raise exception 'Агент олдсонгүй'; end if;
  delete from public.staff_invites where lower(email) = lower(pr.email) and role = 'agent';
  perform public.log_action('Админ: ' || coalesce(pr.full_name, pr.email) || '-ийн агентын эрхийг хаслаа');
end $$;

-- Агентын кодоор хайх (зар оруулахад). Зөвхөн нэр буцаана.
create or replace function public.agent_by_code(p_code text) returns table(id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(split_part(p.full_name, ' ', 1), ''), 'Агент')
  from public.profiles p
  where p.role = 'agent' and not p.is_blocked and p.agent_code = upper(trim(p_code))
$$;

-- ---------- 2. Зарын шинэ баганууд ----------
alter table public.ads add column if not exists agent_id uuid references public.profiles(id) on delete set null;
alter table public.ads add column if not exists expires_at timestamptz;
alter table public.ads add column if not exists expiry_warned_at timestamptz;
alter table public.ads add column if not exists expired_notified_at timestamptz;
alter table public.ads add column if not exists featured_until timestamptz;
alter table public.ads add column if not exists featured_requested_at timestamptz;
create index if not exists ads_agent_idx on public.ads(agent_id) where agent_id is not null;
create index if not exists ads_expires_idx on public.ads(expires_at) where status = 'active';

-- Одоо нийтлэгдсэн зарууд: хугацаа тооцоод, дор хаяж 14 хоногийн зай үлдээнэ (гэнэт алга болохгүй)
update public.ads a set expires_at = greatest(coalesce(a.approved_at, a.created_at) + make_interval(days => s.ad_days), now() + interval '14 days')
from public.settings s
where s.id = 1 and a.status in ('active','hidden') and a.expires_at is null;

-- Агент өөрийн авчирсан зарыг харна
drop policy if exists ads_select_agent on public.ads;
create policy ads_select_agent on public.ads for select using (agent_id is not null and agent_id = auth.uid());

-- Зар бичихэд: ангилал, хугацаа, агент шалгах, хэрэглэгч менежерийн талбарыг бөглөхгүй
create or replace function public.ads_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.settings;
begin
  select * into s from public.settings where id = 1;
  new.category := case when new.year_made >= coalesce(s.cutoff_year, 2016) then 'new' else 'old' end;
  new.updated_at := now();
  if tg_op = 'INSERT' and not public.is_staff() then
    new.views := 0; new.contacted_at := null; new.manager_note := null; new.offer_percent := null;
    new.offer_sent_at := null; new.approved_at := null; new.sold_price := null;
    new.expires_at := null; new.expiry_warned_at := null; new.expired_notified_at := null;
    new.featured_until := null; new.featured_requested_at := null;
  end if;
  -- Агент: зөвхөн идэвхтэй агент, өөрийгөө биш
  if new.agent_id is not null and (tg_op = 'INSERT' or new.agent_id is distinct from old.agent_id) then
    if new.agent_id = new.user_id
       or not exists (select 1 from public.profiles p where p.id = new.agent_id and p.role = 'agent' and not p.is_blocked) then
      new.agent_id := case when tg_op = 'INSERT' then null else old.agent_id end;
    end if;
  end if;
  -- Авто худалдааны шинэ зар шууд нийтлэгдэнэ
  if tg_op = 'INSERT' and new.status = 'pending'
     and exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'dealer' and not p.is_blocked) then
    new.status := 'active';
    new.approved_at := now();
  end if;
  -- Нийтлэгдэх үед хугацаа эхэлнэ (дахин гаргахад үлдсэн хугацаа хэвээр)
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active')
     and (new.expires_at is null or new.expires_at <= now()) then
    new.expires_at := now() + make_interval(days => coalesce(s.ad_days, 60));
    new.expiry_warned_at := null; new.expired_notified_at := null;
  end if;
  return new;
end $$;

-- ---------- 3. Нийтийн зар: хугацаа дууссаныг нуух, онцлох ----------
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
  case when p.role = 'dealer' then coalesce(p.shop_name, 'Авто худалдаа') end as seller_shop,
  coalesce(a.featured_until > now(), false) as featured,
  a.expires_at
from public.ads a
join public.profiles p on p.id = a.user_id
where a.status = 'active' and not p.is_blocked and (a.expires_at is null or a.expires_at > now());
grant select on public.public_ads to anon, authenticated;

-- Хугацаа дууссан зарт үзэлт, лизингийн хүсэлт нэмэгдэхгүй
create or replace function public.increment_view(p_ad uuid) returns void
language sql security definer set search_path = public as $$
  update public.ads set views = views + 1 where id = p_ad and status = 'active' and (expires_at is null or expires_at > now())
$$;

-- ---------- 4. Зар сунгах ----------
create or replace function public.renew_ad(p_ad uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare a public.ads; d int; t timestamptz;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if not (public.is_staff() or (a.user_id = auth.uid() and coalesce(public.my_role(), '') <> '')) then raise exception 'Эрх хүрэхгүй'; end if;
  if a.status not in ('active','hidden') then raise exception 'Зөвхөн нийтлэгдсэн зарыг сунгана'; end if;
  if a.expires_at is not null and a.expires_at > now() + interval '7 days' and not public.is_staff() then
    raise exception 'Дуусахад 7 хоног үлдсэн үед сунгах боломжтой';
  end if;
  select ad_days into d from public.settings where id = 1;
  t := now() + make_interval(days => coalesce(d, 60));
  update public.ads set expires_at = t, expiry_warned_at = null, expired_notified_at = null where id = p_ad;
  perform public.log_action('Зар сунгав: ' || a.brand || ' ' || a.model, a.id);
  return t;
end $$;

-- Цагийн ажил: сануулга (3 хоног үлдсэн), дууссан мэдэгдэл, хуучин алдааны бүртгэл цэвэрлэх
create or replace function public.expire_ads_job() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; m int := 0;
begin
  with w as (
    update public.ads set expiry_warned_at = now()
    where status = 'active' and expiry_warned_at is null and expires_at > now() and expires_at <= now() + interval '3 days'
    returning id, user_id, brand, model, expires_at
  )
  insert into public.notifications(user_id, type, title, body, ad_id)
  select user_id, 'ad_expiring', 'Зарын хугацаа дуусах гэж байна',
         brand || ' ' || model || ' · ' || greatest(1, ceil(extract(epoch from (expires_at - now())) / 86400))::int || ' хоногийн дараа нийтээс хасагдана. Сунгах бол «Миний зар» руу орно уу.', id
  from w;
  get diagnostics n = row_count;

  with x as (
    update public.ads set expired_notified_at = now()
    where status = 'active' and expired_notified_at is null and expires_at <= now()
    returning id, user_id, brand, model
  )
  insert into public.notifications(user_id, type, title, body, ad_id)
  select user_id, 'ad_expired', 'Зарын хугацаа дууслаа',
         brand || ' ' || model || ' нийтэд харагдахаа больсон. «Миний зар» хэсгээс нэг товшилтоор сунгана.', id
  from x;
  get diagnostics m = row_count;

  delete from public.error_logs where last_seen_at < now() - interval '30 days';
  return n + m;
end $$;

-- ---------- 5. Гомдол (зарыг мэдээлэх) ----------
create table if not exists public.ad_flags (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('fake','sold','wrong_price','wrong_info','scam','other')),
  note text check (char_length(coalesce(note, '')) <= 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  action text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ad_flags_status_idx on public.ad_flags(status, created_at desc);
create index if not exists ad_flags_ad_idx on public.ad_flags(ad_id);
create unique index if not exists ad_flags_open_uidx on public.ad_flags(ad_id, user_id) where status = 'open';
alter table public.ad_flags enable row level security;
drop policy if exists ad_flags_staff on public.ad_flags;
create policy ad_flags_staff on public.ad_flags for select using (public.is_staff());
grant select on public.ad_flags to authenticated;

create or replace function public.report_ad(p_ad uuid, p_reason text, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; me public.profiles; fid uuid; n int;
  lbl text := case p_reason when 'fake' then 'Хуурамч зар' when 'sold' then 'Аль хэдийн зарагдсан' when 'wrong_price' then 'Үнэ буруу'
                            when 'wrong_info' then 'Мэдээлэл буруу' when 'scam' then 'Залилан' else 'Бусад' end;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Нэвтэрнэ үү'; end if;
  if me.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if p_reason not in ('fake','sold','wrong_price','wrong_info','scam','other') then raise exception 'Шалтгаанаа сонгоно уу'; end if;
  if p_reason = 'other' and coalesce(trim(p_note), '') = '' then raise exception 'Шалтгаанаа бичнэ үү'; end if;
  select * into a from public.ads where id = p_ad and status = 'active';
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if a.user_id = auth.uid() then raise exception 'Өөрийн зарыг мэдээлэх боломжгүй'; end if;
  if exists (select 1 from public.ad_flags f where f.ad_id = p_ad and f.user_id = auth.uid() and f.status = 'open') then
    raise exception 'Та энэ зарыг аль хэдийн мэдээлсэн байна. Менежер шалгаж байна.';
  end if;
  select count(*) into n from public.ad_flags f where f.user_id = auth.uid() and f.created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Өнөөдөр хэт олон мэдээлэл илгээсэн байна'; end if;
  insert into public.ad_flags(ad_id, user_id, reason, note) values (p_ad, auth.uid(), p_reason, nullif(left(trim(p_note), 500), ''))
  returning id into fid;
  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'ad_flag', 'Зарын гомдол: ' || lbl,
         a.brand || ' ' || a.model || coalesce(' · ' || nullif(left(trim(p_note), 120), ''), ''), a.id
  from public.profiles p where p.role in ('manager','admin') and not p.is_blocked;
  return fid;
end $$;

-- Менежер: гомдол шийдвэрлэх. hide = зарыг нуух (эзэнд мэдэгдэнэ), resolve = зассан, dismiss = үндэслэлгүй
create or replace function public.resolve_flag(p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare f public.ad_flags; a public.ads;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_action not in ('hide','resolve','dismiss') then raise exception 'Буруу үйлдэл'; end if;
  select * into f from public.ad_flags where id = p_id and status = 'open';
  if f.id is null then raise exception 'Гомдол олдсонгүй эсвэл шийдвэрлэгдсэн'; end if;
  select * into a from public.ads where id = f.ad_id;
  if p_action = 'hide' then
    update public.ads set status = 'hidden', manager_note = coalesce(nullif(trim(p_note), ''), manager_note) where id = a.id and status = 'active';
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (a.user_id, 'ad_rejected', 'Таны зар түр нуугдлаа',
            coalesce(nullif(left(trim(p_note), 200), ''), 'Хэрэглэгчийн гомдлоор шалгагдаж байна. Менежерээс асууна уу.'), a.id);
  end if;
  -- Нэг зарын бүх нээлттэй гомдлыг хамт хаана
  update public.ad_flags set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
    action = p_action || coalesce(': ' || nullif(left(trim(p_note), 300), ''), ''), resolved_by = auth.uid(), resolved_at = now()
  where ad_id = f.ad_id and status = 'open';
  perform public.log_action('Гомдол (' || p_action || '): ' || coalesce(a.brand || ' ' || a.model, ''), f.ad_id);
end $$;

drop trigger if exists mz_sync_flags on public.ad_flags;
create trigger mz_sync_flags after insert or update or delete on public.ad_flags
for each row execute function public.mz_broadcast();

-- ---------- 6. Онцлох (VIP) зар ----------
create or replace function public.request_featured(p_ad uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads; s public.settings;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null or a.user_id is distinct from auth.uid() then raise exception 'Зар олдсонгүй'; end if;
  if public.my_role() is null then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if a.status <> 'active' then raise exception 'Зөвхөн нийтлэгдсэн зарыг онцлох болгоно'; end if;
  if a.featured_requested_at > now() - interval '1 day' then raise exception 'Хүсэлт илгээгдсэн байна. Менежер удахгүй холбогдоно.'; end if;
  select * into s from public.settings where id = 1;
  update public.ads set featured_requested_at = now() where id = p_ad;
  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'featured_request', 'Онцлох зарын хүсэлт',
         a.brand || ' ' || a.model || ' · ' || to_char(s.featured_price, 'FM999,999,999') || '₮ / ' || s.featured_days || ' хоног · утас ' || a.phone, a.id
  from public.profiles p where p.role = 'admin' and not p.is_blocked;
end $$;

-- Админ: онцлох болгох (p_days > 0) эсвэл болиулах (0)
create or replace function public.set_featured(p_ad uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_days is null or p_days < 0 or p_days > 365 then raise exception 'Хоног 0–365 байна'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if p_days = 0 then
    update public.ads set featured_until = null, featured_requested_at = null where id = p_ad;
  else
    update public.ads set featured_until = greatest(now(), coalesce(featured_until, now())) + make_interval(days => p_days),
      featured_requested_at = null where id = p_ad;
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (a.user_id, 'featured_on', 'Таны зар онцлох боллоо ⭐', a.brand || ' ' || a.model || ' · ' || p_days || ' хоног жагсаалтын эхэнд харагдана', a.id);
  end if;
  perform public.log_action('Онцлох зар (' || p_days || ' хоног): ' || a.brand || ' ' || a.model, a.id);
end $$;

create or replace function public.update_growth_settings(p_agent_share numeric, p_featured_price bigint, p_featured_days int, p_site_url text) returns void
language plpgsql security definer set search_path = public as $$
declare u text := rtrim(lower(trim(coalesce(p_site_url, ''))), '/');
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_agent_share is null or p_agent_share < 0 or p_agent_share > 100 then raise exception 'Агентын хувь 0–100 байна'; end if;
  if p_featured_price is null or p_featured_price < 0 then raise exception 'Онцлох зарын үнэ буруу'; end if;
  if p_featured_days is null or p_featured_days not between 1 and 365 then raise exception 'Онцлох хоног 1–365 байна'; end if;
  if u !~ '^https://[^/\s]+$' then raise exception 'Сайтын хаяг https://домэйн хэлбэртэй байна'; end if;
  update public.settings set agent_share = p_agent_share, featured_price = p_featured_price, featured_days = p_featured_days,
    site_url = u, updated_at = now() where id = 1;
  perform public.log_action('Тохиргоо: агент/онцлох/сайт');
end $$;

-- ---------- 7. Борлуулалтын тайлан: агентын шимтгэл ----------
alter table public.sale_reports add column if not exists agent_id uuid references public.profiles(id) on delete set null;
alter table public.sale_reports add column if not exists agent_share numeric(5,2);
alter table public.sale_reports add column if not exists agent_amount bigint;
alter table public.sale_reports add column if not exists agent_paid_at timestamptz;
create index if not exists sale_reports_agent_idx on public.sale_reports(agent_id, created_at desc) where agent_id is not null;

drop policy if exists sale_reports_read on public.sale_reports;
create policy sale_reports_read on public.sale_reports for select
  using (manager_id = auth.uid() or public.is_admin() or (agent_id is not null and agent_id = auth.uid()));

drop function if exists public.submit_sale_report(uuid, bigint, timestamptz, text, text, text);
create or replace function public.submit_sale_report(
  p_ad uuid, p_price bigint, p_sold_at timestamptz default now(),
  p_buyer_name text default null, p_buyer_phone text default null, p_note text default null,
  p_agent uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; c record; rid uuid; amt bigint; me public.profiles; ag uuid; sh numeric; ag_amt bigint;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if a.status not in ('active','sold') then raise exception 'Зөвхөн нийтлэгдсэн зарыг зарагдсан гэж тайлагнана'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Зарагдсан үнэ оруулна уу'; end if;
  if exists (select 1 from public.sale_reports r where r.ad_id = p_ad and r.status <> 'rejected') then
    raise exception 'Энэ зарын тайлан аль хэдийн илгээгдсэн байна';
  end if;
  select * into c from public.commission_for(p_ad, coalesce(p_sold_at, now()));
  amt := round(p_price * c.percent / 100);
  -- Агент: маягтаас сонгосон, эсвэл зарт бүртгэгдсэн
  ag := coalesce(p_agent, a.agent_id);
  if ag is not null and not exists (select 1 from public.profiles p where p.id = ag and p.role = 'agent') then
    raise exception 'Сонгосон хүн агент биш байна';
  end if;
  if ag is not null then
    select agent_share into sh from public.settings where id = 1;
    ag_amt := round(amt * coalesce(sh, 0) / 100);
    if p_agent is not null and a.agent_id is distinct from p_agent then update public.ads set agent_id = p_agent where id = a.id; end if;
  end if;
  insert into public.sale_reports(ad_id, manager_id, sold_price, sold_at, buyer_name, buyer_phone, note,
                                  days_on_market, commission_percent, commission_amount, agent_id, agent_share, agent_amount)
  values (p_ad, auth.uid(), p_price, coalesce(p_sold_at, now()), nullif(trim(p_buyer_name), ''),
          nullif(trim(p_buyer_phone), ''), nullif(left(trim(p_note), 1000), ''), c.days, c.percent, amt, ag, case when ag is not null then sh end, ag_amt)
  returning id into rid;
  select * into me from public.profiles where id = auth.uid();
  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'sale_report', 'Шинэ тайлан: ' || a.brand || ' ' || a.model || ' зарагдлаа',
         coalesce(me.full_name, me.email, 'Менежер') || ' · ' || to_char(p_price, 'FM999,999,999,999') || '₮ · '
         || c.days || ' хоног · шимтгэл ' || c.percent || '% = ' || to_char(amt, 'FM999,999,999,999') || '₮'
         || case when ag is not null then ' · агент ' || to_char(ag_amt, 'FM999,999,999,999') || '₮' else '' end,
         a.id
  from public.profiles p where p.role = 'admin' and not p.is_blocked and p.id <> auth.uid();
  perform public.log_action('Тайлан илгээв: ' || a.brand || ' ' || a.model || ' зарагдсан', a.id);
  return rid;
end $$;

create or replace function public.review_sale_report(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.sale_reports; a public.ads;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.sale_reports set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'pending' returning * into r;
  if r.id is null then raise exception 'Тайлан олдсонгүй эсвэл аль хэдийн шийдвэрлэгдсэн'; end if;
  select * into a from public.ads where id = r.ad_id;
  if p_approve and a.status = 'active' then
    update public.ads set status = 'sold', sold_at = r.sold_at, sold_price = r.sold_price where id = a.id;
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (a.user_id, 'sold', 'Таны машин зарагдлаа', a.brand || ' ' || a.model || ' · ' || to_char(r.sold_price, 'FM999,999,999,999') || '₮', a.id);
  end if;
  if r.manager_id is not null then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (r.manager_id, 'report_reviewed',
            case when p_approve then 'Тайлан батлагдлаа' else 'Тайлан буцаагдлаа' end,
            coalesce(a.brand || ' ' || a.model, 'Зар') || coalesce(' · ' || nullif(trim(p_note), ''), ''), r.ad_id);
  end if;
  if p_approve and r.agent_id is not null and coalesce(r.agent_amount, 0) > 0 then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (r.agent_id, 'agent_commission', 'Шимтгэл бодогдлоо 🎉',
            coalesce(a.brand || ' ' || a.model, 'Зар') || ' зарагдсан · таны хувь ' || to_char(r.agent_amount, 'FM999,999,999,999') || '₮', r.ad_id);
  end if;
  perform public.log_action(case when p_approve then 'Тайлан баталлаа: ' else 'Тайлан буцаалаа: ' end || coalesce(a.brand || ' ' || a.model, ''), r.ad_id);
end $$;

-- Админ: агентад шимтгэл төлсөн / төлөөгүй
create or replace function public.set_agent_paid(p_id uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.sale_reports;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.sale_reports set agent_paid_at = case when p_paid then now() end
  where id = p_id and agent_id is not null and status = 'approved' returning * into r;
  if r.id is null then raise exception 'Батлагдсан, агенттай тайлан олдсонгүй'; end if;
  if p_paid then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (r.agent_id, 'agent_commission', 'Шимтгэл шилжүүлэгдлээ', to_char(r.agent_amount, 'FM999,999,999,999') || '₮ төлөгдсөн гэж бүртгэгдлээ', r.ad_id);
  end if;
end $$;

-- Менежер: зарт агент оноох / хасах
create or replace function public.set_ad_agent(p_ad uuid, p_agent uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_agent is not null and not exists (select 1 from public.profiles where id = p_agent and role = 'agent') then
    raise exception 'Агент олдсонгүй';
  end if;
  update public.ads set agent_id = p_agent where id = p_ad;
  if not found then raise exception 'Зар олдсонгүй'; end if;
end $$;

-- ---------- 8. Алдааны бүртгэл ----------
create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('web','server','app')),
  message text not null,
  stack text,
  url text,
  user_agent text,
  app_version text,
  user_id uuid references public.profiles(id) on delete set null,
  fingerprint text not null,
  hits int not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists error_logs_seen_idx on public.error_logs(last_seen_at desc);
create index if not exists error_logs_fp_idx on public.error_logs(fingerprint, last_seen_at desc);
alter table public.error_logs enable row level security;
drop policy if exists error_logs_admin on public.error_logs;
create policy error_logs_admin on public.error_logs for select using (public.is_admin());
drop policy if exists error_logs_admin_del on public.error_logs;
create policy error_logs_admin_del on public.error_logs for delete using (public.is_admin());
grant select, delete on public.error_logs to authenticated;

-- Хэн ч (нэвтрээгүй ч) алдаа илгээнэ. Ижил алдааг 1 цагийн дотор нэгтгэж, нийт урсгалыг хязгаарлана.
create or replace function public.log_client_error(
  p_source text, p_message text, p_stack text default null, p_url text default null, p_ua text default null, p_version text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare src text := case when p_source in ('web','server','app') then p_source else 'web' end;
  msg text := left(coalesce(nullif(trim(p_message), ''), 'Тодорхойгүй алдаа'), 500);
  fp text; n int;
begin
  fp := md5(src || '|' || regexp_replace(msg, '[0-9a-f]{8}-[0-9a-f-]{27}|\d+', '#', 'gi'));
  update public.error_logs set hits = hits + 1, last_seen_at = now(),
    url = coalesce(left(p_url, 300), url), user_id = coalesce(auth.uid(), user_id)
  where id = (select id from public.error_logs where fingerprint = fp and last_seen_at > now() - interval '1 hour' order by id desc limit 1);
  if found then return; end if;
  select count(*) into n from public.error_logs where created_at > now() - interval '1 hour';
  if n >= 300 then return; end if;
  insert into public.error_logs(source, message, stack, url, user_agent, app_version, user_id, fingerprint)
  values (src, msg, left(p_stack, 4000), left(p_url, 300), left(p_ua, 200), left(p_version, 40), auth.uid(), fp);
end $$;

-- ---------- 9. Push: холбоос нэг газраас, сайтын хаяг тохиргооноос ----------
create or replace function public.notify_url(p_type text, p_ad uuid) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'sale_report' then '/admin/reports'
    when p_type = 'report_reviewed' then '/manager/reports'
    when p_type = 'loan_request' then '/leasing'
    when p_type = 'loan_update' then '/loans'
    when p_type = 'agent_commission' then '/agent'
    when p_type in ('ad_expiring','ad_expired','featured_on') then '/my'
    when p_type = 'ad_flag' then '/manager/flags'
    when p_type = 'featured_request' then '/admin/ads?featured=1'
    when p_ad is null then '/notifications'
    when p_type = 'staff_new_ad' then '/manager/ads?id=' || p_ad
    else '/ads/' || p_ad
  end
$$;

create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare msgs jsonb; wmsgs jsonb; chunk jsonb; i int; n int; sec text := public.push_secret();
  site text := coalesce((select site_url from public.settings where id = 1), 'https://web-mu-fawn-45.vercel.app');
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
           'url', public.notify_url(r.type, r.ad_id))), '[]'::jsonb)
    into wmsgs
  from new_rows r join public.web_push_subs w on w.user_id = r.user_id;
  i := 0; n := jsonb_array_length(wmsgs);
  while i < n loop
    select jsonb_agg(x.e order by x.k) into chunk from jsonb_array_elements(wmsgs) with ordinality as x(e, k) where x.k > i and x.k <= i + 200;
    begin
      perform net.http_post(url := site || '/api/push/web', body := jsonb_build_object('messages', chunk),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', coalesce(sec, '')), timeout_milliseconds := 30000);
    exception when others then null;
    end;
    i := i + 200;
  end loop;
  return null;
end $$;

-- ---------- 10. Эрх (GRANT) ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.new_agent_code()', 'public.profiles_agent_code()', 'public.expire_ads_job()', 'public.notify_push()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.invite_agent(text, text, text)', 'public.remove_agent(uuid)', 'public.agent_by_code(text)',
    'public.renew_ad(uuid)', 'public.report_ad(uuid, text, text)', 'public.resolve_flag(uuid, text, text)',
    'public.request_featured(uuid)', 'public.set_featured(uuid, int)', 'public.update_growth_settings(numeric, bigint, int, text)',
    'public.submit_sale_report(uuid, bigint, timestamptz, text, text, text, uuid)', 'public.review_sale_report(uuid, boolean, text)',
    'public.set_agent_paid(uuid, boolean)', 'public.set_ad_agent(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.log_client_error(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.increment_view(uuid) to anon, authenticated;
grant execute on function public.notify_url(text, uuid) to authenticated;

-- ---------- 11. Цагийн ажил (pg_cron) ----------
-- Supabase → Database → Extensions → pg_cron асаагүй бол энэ хэсэг алгасагдана
-- (хугацаа дууссан зар нийтэд харагдахгүй хэвээр, зөвхөн сануулга мэдэгдэл ирэхгүй).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'mz-expire-ads';
  perform cron.schedule('mz-expire-ads', '17 * * * *', 'select public.expire_ads_job()');
exception when others then
  raise notice 'pg_cron: % (Database → Extensions → pg_cron асаагаад дахин ажиллуулна уу)', sqlerrm;
end $$;

notify pgrst, 'reload schema';
