-- =====================================================================
-- Машин зар — Supabase schema (вэб + апп хоёуланд нэг өгөгдлийн сан)
-- Supabase → SQL Editor → New query → энэ файлыг бүтнээр нь хуулж Run.
-- Дахин ажиллуулахад аюулгүй (idempotent) байхаар бичсэн.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Тохиргоо (ганц мөр)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  offer_percent numeric(5,2),            -- менежерийн санал тооцох хувь (null = тохируулаагүй)
  cutoff_year int not null default 2016, -- "2016 ба хойш" / "2016-аас өмнө" заагийн он
  max_photos int not null default 16,
  min_photos int not null default 3,
  ad_days int not null default 60,
  notify_all_on_approve boolean not null default true,
  notify_staff_on_new boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Профайл
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  city text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','manager','admin')),
  is_blocked boolean not null default false,
  profile_completed boolean not null default false,
  notify_new_ads boolean not null default true,
  notify_category text check (notify_category in ('new','old')),
  notify_brand text,
  notify_max_price bigint,
  created_at timestamptz not null default now()
);

-- Менежер / админ болгох урилга (Google и-мэйлээр)
create table if not exists public.staff_invites (
  email text primary key,
  role text not null check (role in ('manager','admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Зар
-- ---------------------------------------------------------------------
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand text not null,
  model text not null,
  trim text,                       -- аль сер
  plate_number text not null,      -- улсын дугаар
  vin text not null,               -- арлын дугаар
  phone text not null,
  year_made int not null check (year_made between 1950 and 2100),
  year_imported int check (year_imported between 1950 and 2100),
  options text[] not null default '{}',
  modifications text,              -- нэмж хийсэн зүйлс
  description text,
  price bigint not null check (price > 0),
  photos text[] not null default '{}', -- storage дахь замууд, эхнийх нь нүүр зураг
  category text not null default 'new' check (category in ('new','old')),
  status text not null default 'pending' check (status in ('pending','active','sold','rejected')),
  views int not null default 0,
  manager_id uuid references public.profiles(id) on delete set null,
  manager_note text,
  contacted_at timestamptz,
  offer_percent numeric(5,2),
  offer_amount bigint,
  offer_sent_at timestamptz,
  approved_at timestamptz,
  sold_at timestamptz,
  sold_price bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photos_max check (coalesce(array_length(photos,1),0) <= 16)
);
create index if not exists ads_status_idx on public.ads(status, created_at desc);
create index if not exists ads_user_idx on public.ads(user_id);
create index if not exists ads_category_idx on public.ads(category);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ad_id uuid not null references public.ads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ad_id)
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,              -- new_ad | ad_approved | ad_rejected | offer | contacted | staff_new_ad | sold
  title text not null,
  body text,
  ad_id uuid references public.ads(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  ad_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Туслах функцууд
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and not is_blocked
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('manager','admin'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.mask_plate(p text) returns text
language sql immutable as $$
  -- "1234 УБА" -> "12** УБ*"
  select case
    when p is null then null
    when position(' ' in trim(p)) > 0 then
      left(split_part(trim(p),' ',1),2) || repeat('*', greatest(length(split_part(trim(p),' ',1))-2,0))
      || ' ' || left(split_part(trim(p),' ',2),2) || repeat('*', greatest(length(split_part(trim(p),' ',2))-2,0))
    else left(p,2) || repeat('*', greatest(length(p)-2,0))
  end
$$;

create or replace function public.mask_vin(v text) returns text
language sql immutable as $$
  select case
    when v is null then null
    when position('-' in v) > 0 then split_part(v,'-',1) || '-••••'
    else left(v,5) || '••••'
  end
$$;

create or replace function public.log_action(p_action text, p_ad uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.activity_log(actor_id, action, ad_id) values (auth.uid(), p_action, p_ad)
$$;

-- ---------------------------------------------------------------------
-- Шинэ хэрэглэгч → профайл (урилга байвал эрх онооно)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.staff_invites;
begin
  select * into inv from public.staff_invites where lower(email) = lower(new.email);
  insert into public.profiles (id, email, full_name, avatar_url, role, phone)
  values (
    new.id,
    new.email,
    coalesce(inv.full_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(inv.role, 'user'),
    inv.phone
  )
  on conflict (id) do nothing;
  insert into public.activity_log(actor_id, action) values (new.id, 'Шинэ хэрэглэгч бүртгүүлэв: ' || coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Зарын ангилал + updated_at
-- ---------------------------------------------------------------------
create or replace function public.ads_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare cutoff int;
begin
  select cutoff_year into cutoff from public.settings where id = 1;
  new.category := case when new.year_made >= coalesce(cutoff, 2016) then 'new' else 'old' end;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ads_before_write on public.ads;
create trigger ads_before_write before insert or update on public.ads
for each row execute function public.ads_before_write();

-- Шинэ зар ирэхэд менежерүүдэд мэдэгдэл
create or replace function public.ads_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select notify_staff_on_new from public.settings where id = 1) then
    insert into public.notifications(user_id, type, title, body, ad_id)
    select p.id, 'staff_new_ad', 'Шинэ зар ирлээ',
           new.brand || ' ' || new.model || ' · ' || new.year_made || ' · ' || to_char(new.price, 'FM999,999,999,999') || '₮',
           new.id
    from public.profiles p where p.role in ('manager','admin') and not p.is_blocked;
  end if;
  insert into public.activity_log(actor_id, action, ad_id)
  values (new.user_id, new.brand || ' ' || new.model || ' зар илгээгдэв', new.id);
  return new;
end $$;

drop trigger if exists ads_after_insert on public.ads;
create trigger ads_after_insert after insert on public.ads
for each row execute function public.ads_after_insert();

-- ---------------------------------------------------------------------
-- Нийтэд харагдах зар (дугаар нуусан) — зөвхөн идэвхтэй зарууд
-- ---------------------------------------------------------------------
drop view if exists public.public_ads;
create view public.public_ads as
select
  a.id, a.brand, a.model, a.trim,
  public.mask_plate(a.plate_number) as plate_masked,
  public.mask_vin(a.vin) as vin_masked,
  a.phone, a.year_made, a.year_imported, a.options, a.modifications, a.description,
  a.price, a.photos, a.category, a.status, a.views, a.approved_at, a.created_at,
  a.user_id,
  split_part(coalesce(p.full_name, 'Хэрэглэгч'), ' ', 1) as seller_name,
  p.city as seller_city,
  (select count(*) from public.ads x where x.user_id = a.user_id and x.status in ('active','sold'))::int as seller_ad_count
from public.ads a
join public.profiles p on p.id = a.user_id
where a.status = 'active';

grant select on public.public_ads to anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.ads enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.activity_log enable row level security;

-- settings
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- staff_invites
drop policy if exists invites_admin on public.staff_invites;
create policy invites_admin on public.staff_invites for all using (public.is_admin()) with check (public.is_admin());

-- ads
drop policy if exists ads_select on public.ads;
create policy ads_select on public.ads for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and manager_id is null and offer_amount is null and sold_at is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_blocked and p.profile_completed)
);
drop policy if exists ads_update_admin on public.ads;
create policy ads_update_admin on public.ads for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists ads_delete on public.ads;
create policy ads_delete on public.ads for delete using (
  public.is_admin()
  or (user_id = auth.uid() and status in ('pending','active','rejected'))
);

-- favorites
drop policy if exists fav_own on public.favorites;
create policy fav_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select using (user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete using (user_id = auth.uid());

-- push tokens
drop policy if exists push_own on public.push_tokens;
create policy push_own on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_staff_read on public.push_tokens;
create policy push_staff_read on public.push_tokens for select using (public.is_staff());

-- activity log
drop policy if exists log_staff on public.activity_log;
create policy log_staff on public.activity_log for select using (public.is_staff());

-- ---------------------------------------------------------------------
-- RPC: менежер / админы үйлдлүүд
-- ---------------------------------------------------------------------
create or replace function public.approve_ad(p_ad uuid) returns int
language plpgsql security definer set search_path = public as $$
declare a public.ads; s public.settings; n int := 0;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.ads set status = 'active', approved_at = now(), manager_id = auth.uid()
  where id = p_ad and status in ('pending','rejected') returning * into a;
  if a.id is null then raise exception 'Зар олдсонгүй эсвэл аль хэдийн батлагдсан'; end if;
  select * into s from public.settings where id = 1;

  insert into public.notifications(user_id, type, title, body, ad_id)
  values (a.user_id, 'ad_approved', 'Таны зар батлагдлаа',
          a.brand || ' ' || a.model || ' одоо бүх хэрэглэгчид харагдаж байна', a.id);

  if s.notify_all_on_approve then
    insert into public.notifications(user_id, type, title, body, ad_id)
    select p.id, 'new_ad', 'Шинэ зар',
           a.brand || ' ' || a.model || ' · ' || a.year_made || ' · ' || to_char(a.price, 'FM999,999,999,999') || '₮', a.id
    from public.profiles p
    where p.id <> a.user_id and not p.is_blocked and p.notify_new_ads
      and (p.notify_category is null or p.notify_category = a.category)
      and (p.notify_brand is null or lower(p.notify_brand) = lower(a.brand))
      and (p.notify_max_price is null or a.price <= p.notify_max_price);
    get diagnostics n = row_count;
  end if;
  perform public.log_action('Зар баталлаа: ' || a.brand || ' ' || a.model, a.id);
  return n;
end $$;

create or replace function public.reject_ad(p_ad uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.ads set status = 'rejected', manager_id = auth.uid(), manager_note = coalesce(p_note, manager_note)
  where id = p_ad returning * into a;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  insert into public.notifications(user_id, type, title, body, ad_id)
  values (a.user_id, 'ad_rejected', 'Таны зар татгалзагдлаа', coalesce(p_note, 'Дэлгэрэнгүйг менежерээс асууна уу'), a.id);
  perform public.log_action('Зар татгалзлаа: ' || a.brand || ' ' || a.model, a.id);
end $$;

create or replace function public.mark_contacted(p_ad uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.ads set contacted_at = now(), manager_id = auth.uid(), manager_note = coalesce(p_note, manager_note)
  where id = p_ad returning * into a;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  perform public.log_action('Холбогдсон: ' || a.brand || ' ' || a.model, a.id);
end $$;

create or replace function public.save_note(p_ad uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.ads set manager_note = p_note where id = p_ad;
end $$;

create or replace function public.send_offer(p_ad uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.ads; pct numeric; amt bigint;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  select offer_percent into pct from public.settings where id = 1;
  if pct is null then raise exception 'Админ санал тооцох хувийг тохируулаагүй байна'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  amt := round(a.price * pct / 100);
  update public.ads set offer_percent = pct, offer_amount = amt, offer_sent_at = now(), manager_id = auth.uid() where id = p_ad;
  insert into public.notifications(user_id, type, title, body, ad_id)
  values (a.user_id, 'offer', 'Танд санал ирлээ',
          a.brand || ' ' || a.model || ': ' || to_char(amt, 'FM999,999,999,999') || '₮ (' || pct || '%)', a.id);
  perform public.log_action('Санал илгээв: ' || a.brand || ' ' || a.model, a.id);
  return amt;
end $$;

create or replace function public.mark_sold(p_ad uuid, p_price bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.ads set status = 'sold', sold_at = now(), sold_price = coalesce(p_price, price)
  where id = p_ad and status = 'active' returning * into a;
  if a.id is null then raise exception 'Зөвхөн идэвхтэй зарыг зарагдсан болгоно'; end if;
  insert into public.notifications(user_id, type, title, body, ad_id)
  values (a.user_id, 'sold', 'Зар зарагдсан гэж тэмдэглэгдлээ', a.brand || ' ' || a.model, a.id);
  perform public.log_action(a.brand || ' ' || a.model || ' зарагдсан гэж тэмдэглэв', a.id);
end $$;

-- Админ: аккаунт хаах / нээх
create or replace function public.set_blocked(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_user = auth.uid() then raise exception 'Өөрийгөө хааж болохгүй'; end if;
  update public.profiles set is_blocked = p_blocked where id = p_user returning * into pr;
  perform public.log_action('Админ: ' || coalesce(pr.full_name, pr.email) || ' аккаунтыг ' || case when p_blocked then 'хаалаа' else 'нээлээ' end);
end $$;

-- Админ: менежер / админ нэмэх (Google и-мэйлээр). Бүртгэлтэй бол шууд эрх олгоно.
create or replace function public.invite_staff(p_email text, p_role text, p_name text default null, p_phone text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_role not in ('manager','admin') then raise exception 'Буруу эрх'; end if;
  insert into public.staff_invites(email, role, full_name, phone) values (lower(trim(p_email)), p_role, p_name, p_phone)
  on conflict (email) do update set role = excluded.role, full_name = excluded.full_name, phone = excluded.phone;
  update public.profiles set role = p_role, is_blocked = false,
    full_name = coalesce(full_name, p_name), phone = coalesce(phone, p_phone)
  where lower(email) = lower(trim(p_email));
  perform public.log_action('Админ: ' || p_email || ' → ' || p_role);
end $$;

create or replace function public.remove_staff(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_user = auth.uid() then raise exception 'Өөрийн эрхийг хасаж болохгүй'; end if;
  update public.profiles set role = 'user' where id = p_user returning * into pr;
  delete from public.staff_invites where lower(email) = lower(pr.email);
  perform public.log_action('Админ: ' || coalesce(pr.full_name, pr.email) || '-ийн менежер эрхийг хаслаа');
end $$;

create or replace function public.update_settings(
  p_offer_percent numeric, p_cutoff_year int, p_max_photos int, p_min_photos int, p_ad_days int,
  p_notify_all boolean, p_notify_staff boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare old_cutoff int;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  select cutoff_year into old_cutoff from public.settings where id = 1;
  update public.settings set offer_percent = p_offer_percent, cutoff_year = p_cutoff_year,
    max_photos = least(greatest(p_max_photos,1),16), min_photos = greatest(p_min_photos,1), ad_days = p_ad_days,
    notify_all_on_approve = p_notify_all, notify_staff_on_new = p_notify_staff, updated_at = now()
  where id = 1;
  if old_cutoff is distinct from p_cutoff_year then
    update public.ads set category = case when year_made >= p_cutoff_year then 'new' else 'old' end;
  end if;
  perform public.log_action('Тохиргоо өөрчиллөө');
end $$;

-- Үзэлт нэмэх (хэн ч)
create or replace function public.increment_view(p_ad uuid) returns void
language sql security definer set search_path = public as $$
  update public.ads set views = views + 1 where id = p_ad and status = 'active'
$$;

-- Шинэ зарын push токенууд (менежер батлахад вэб сервер Expo push руу илгээнэ)
create or replace function public.push_targets(p_ad uuid) returns table(token text, user_id uuid, title text, body text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  return query
    select t.token, t.user_id, n.title, n.body
    from public.notifications n
    join public.push_tokens t on t.user_id = n.user_id
    where n.ad_id = p_ad and n.created_at > now() - interval '5 minutes'
      and n.type in ('new_ad','ad_approved','ad_rejected','offer','sold');
end $$;

-- Хэрэглэгч өөрийн хаагдсан эсэх / эрхийг шалгах
create or replace function public.me() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Эрх (GRANT) — шинэ Supabase project-д автоматаар өгөгддөггүй
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- Нээлттэй унших
grant select on public.settings to anon, authenticated;
grant select on public.public_ads to anon, authenticated;

-- Нэвтэрсэн хэрэглэгч (мөр бүрийг RLS хамгаална)
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.ads to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert, update, delete on public.staff_invites to authenticated;
grant select on public.activity_log to authenticated;
grant update on public.settings to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Профайл: зөвхөн эдгээр баганыг өөрөө бичнэ (role, is_blocked-ийг өөрчилж чадахгүй)
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, email, full_name, avatar_url) on public.profiles to authenticated;
grant update (full_name, phone, city, profile_completed, notify_new_ads, notify_category, notify_brand, notify_max_price)
  on public.profiles to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'user' and not is_blocked);

-- Функцууд
grant execute on all functions in schema public to anon, authenticated;
revoke execute on function public.approve_ad, public.reject_ad, public.mark_contacted, public.save_note,
  public.send_offer, public.mark_sold, public.set_blocked, public.invite_staff, public.remove_staff,
  public.update_settings, public.push_targets from anon;
revoke execute on function public.log_action from anon, authenticated;


-- ---------------------------------------------------------------------
-- Зургийн сан (Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-photos', 'ad-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608;

drop policy if exists "ad photos read" on storage.objects;
create policy "ad photos read" on storage.objects for select using (bucket_id = 'ad-photos');
drop policy if exists "ad photos upload own" on storage.objects;
create policy "ad photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ad photos delete own" on storage.objects;
create policy "ad photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'ad-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------
-- Realtime (мэдэгдэл шууд ирэх)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

-- ---------------------------------------------------------------------
-- Realtime + апп татах холбоос
-- ---------------------------------------------------------------------
-- Апп (APK) татах холбоос
alter table public.settings add column if not exists apk_url text;
alter table public.settings add column if not exists apk_version text;
alter table public.settings add column if not exists apk_updated_at timestamptz;

create or replace function public.set_app_link(p_url text, p_version text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.settings set apk_url = nullif(trim(p_url), ''), apk_version = nullif(trim(p_version), ''),
    apk_updated_at = now(), updated_at = now() where id = 1;
  perform public.log_action('Апп татах холбоос шинэчиллээ');
end $$;
revoke execute on function public.set_app_link from anon;
grant execute on function public.set_app_link to authenticated;

-- ---------------------------------------------------------------------
-- Өөрчлөлт бүрийг "mz-sync" нийтийн суваг руу дохио болгон илгээнэ.
-- Дохионд зөвхөн хүснэгтийн нэр, мөрийн id, төлөв орно (нууц мэдээлэл ороогүй).
-- Вэб, апп хоёр энэ дохиог сонсоод өөрсдийн эрхээр өгөгдлөө дахин уншина.
-- ---------------------------------------------------------------------
create or replace function public.mz_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec record; payload jsonb;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  -- Зөвхөн үзэлтийн тоо өөрчлөгдсөн бол дохио илгээхгүй (дахин дахин шинэчлэгдэхээс сэргийлнэ)
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'views' - 'updated_at') = (to_jsonb(old) - 'views' - 'updated_at') then
    return null;
  end if;
  payload := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', to_jsonb(rec)->>'id');
  if tg_table_name = 'ads' then
    payload := payload || jsonb_build_object('status', to_jsonb(rec)->>'status');
  end if;
  begin
    perform realtime.send(payload, 'change', 'mz-sync', false);
  exception when others then
    -- realtime ажиллахгүй үед өгөгдөл бичих үйлдлийг саатуулахгүй
    null;
  end;
  return null;
end $$;

drop trigger if exists mz_sync_ads on public.ads;
create trigger mz_sync_ads after insert or update or delete on public.ads
for each row execute function public.mz_broadcast();

drop trigger if exists mz_sync_profiles on public.profiles;
create trigger mz_sync_profiles after insert or update or delete on public.profiles
for each row execute function public.mz_broadcast();

drop trigger if exists mz_sync_settings on public.settings;
create trigger mz_sync_settings after update on public.settings
for each row execute function public.mz_broadcast();

drop trigger if exists mz_sync_invites on public.staff_invites;
create trigger mz_sync_invites after insert or update or delete on public.staff_invites
for each row execute function public.mz_broadcast();

-- Хувийн мэдэгдлүүд RLS-ээр хамгаалагдсан realtime-аар ирнэ
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;

-- ---------------------------------------------------------------------
-- Push мэдэгдэл: notifications-д мөр нэмэгдэхэд Expo push руу шууд илгээнэ
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare msgs jsonb; chunk jsonb; i int := 0; n int;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', r.title,
           'body', coalesce(r.body, ''),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default',
           'data', jsonb_build_object('adId', r.ad_id, 'type', r.type, 'id', r.id))), '[]'::jsonb)
    into msgs
  from new_rows r
  join public.push_tokens t on t.user_id = r.user_id;

  n := jsonb_array_length(msgs);
  while i < n loop
    select jsonb_agg(x.e order by x.k) into chunk
    from jsonb_array_elements(msgs) with ordinality as x(e, k)
    where x.k > i and x.k <= i + 100;
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := chunk,
        headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
      );
    exception when others then
      null; -- push илгээж чадаагүй ч мэдэгдэл хадгалагдана
    end;
    i := i + 100;
  end loop;
  return null;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
referencing new table as new_rows
for each statement execute function public.notify_push();

-- Админы зарлал: бүх (хаагдаагүй) хэрэглэгчид мэдэгдэл + push
create or replace function public.broadcast(p_title text, p_body text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Гарчиг хоосон байна'; end if;
  insert into public.notifications(user_id, type, title, body)
  select p.id, 'broadcast', trim(p_title), nullif(trim(p_body), '')
  from public.profiles p where not p.is_blocked;
  get diagnostics n = row_count;
  perform public.log_action('Зарлал илгээв: ' || trim(p_title));
  return n;
end $$;
revoke execute on function public.broadcast from anon;
grant execute on function public.broadcast to authenticated;

-- ---------------------------------------------------------------------
-- Вэб push (iPhone нүүр дэлгэцийн апп, Chrome, компьютер)
-- ---------------------------------------------------------------------
create table if not exists public.web_push_subs (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists web_push_subs_user_idx on public.web_push_subs(user_id);
alter table public.web_push_subs enable row level security;
drop policy if exists webpush_own_read on public.web_push_subs;
create policy webpush_own_read on public.web_push_subs for select using (user_id = auth.uid());
grant select on public.web_push_subs to authenticated;

-- Захиалга хадгалах (нэг төхөөрөмж өөр хүнээр нэвтэрвэл шинэ эзэнд шилжинэ)
create or replace function public.save_web_push(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нэвтрээгүй байна'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' then raise exception 'Буруу захиалга'; end if;
  insert into public.web_push_subs(endpoint, user_id, p256dh, auth, ua)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua;
end $$;

create or replace function public.remove_web_push(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.web_push_subs where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- Хүчингүй болсон захиалгыг устгах (endpoint нь өөрөө нууц тул мэддэг хүн л устгана)
create or replace function public.prune_web_push(p_endpoints text[]) returns void
language sql security definer set search_path = public as $$
  delete from public.web_push_subs where endpoint = any(p_endpoints)
$$;

revoke execute on function public.save_web_push(text, text, text, text) from public, anon;
revoke execute on function public.remove_web_push(text) from public, anon;
grant execute on function public.save_web_push(text, text, text, text) to authenticated;
grant execute on function public.remove_web_push(text) to authenticated;
grant execute on function public.prune_web_push(text[]) to anon, authenticated;

-- Мэдэгдэл → Expo push (Android апп) + вэб push
create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare msgs jsonb; wmsgs jsonb; chunk jsonb; i int; n int;
begin
  -- 1) Android апп (Expo)
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', r.title,
           'body', coalesce(r.body, ''),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default',
           'data', jsonb_build_object('adId', r.ad_id, 'type', r.type, 'id', r.id))), '[]'::jsonb)
    into msgs
  from new_rows r
  join public.push_tokens t on t.user_id = r.user_id;

  i := 0; n := jsonb_array_length(msgs);
  while i < n loop
    select jsonb_agg(x.e order by x.k) into chunk
    from jsonb_array_elements(msgs) with ordinality as x(e, k)
    where x.k > i and x.k <= i + 100;
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := chunk,
        headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
      );
    exception when others then null;
    end;
    i := i + 100;
  end loop;

  -- 2) Вэб push (iPhone, Chrome, компьютер)
  select coalesce(jsonb_agg(jsonb_build_object(
           'sub', jsonb_build_object('endpoint', w.endpoint, 'keys', jsonb_build_object('p256dh', w.p256dh, 'auth', w.auth)),
           'title', r.title,
           'body', coalesce(r.body, ''),
           'tag', r.type || coalesce('-' || r.ad_id::text, ''),
           'url', case
                    when r.ad_id is null then '/notifications'
                    when r.type = 'staff_new_ad' then '/manager/ads?id=' || r.ad_id
                    else '/ads/' || r.ad_id
                  end)), '[]'::jsonb)
    into wmsgs
  from new_rows r
  join public.web_push_subs w on w.user_id = r.user_id;

  i := 0; n := jsonb_array_length(wmsgs);
  while i < n loop
    select jsonb_agg(x.e order by x.k) into chunk
    from jsonb_array_elements(wmsgs) with ordinality as x(e, k)
    where x.k > i and x.k <= i + 200;
    begin
      perform net.http_post(
        url := 'https://web-mu-fawn-45.vercel.app/api/push/web',
        body := jsonb_build_object('messages', chunk),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 30000
      );
    exception when others then null;
    end;
    i := i + 200;
  end loop;
  return null;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
referencing new table as new_rows
for each statement execute function public.notify_push();

-- ---------------------------------------------------------------------
-- Админы зарлалын түүх, устгах, дахин илгээх
-- ---------------------------------------------------------------------
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  recipients int not null default 0
);
alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_admin on public.broadcasts;
create policy broadcasts_admin on public.broadcasts for select using (public.is_admin());
grant select on public.broadcasts to authenticated;

alter table public.notifications add column if not exists broadcast_id uuid references public.broadcasts(id) on delete cascade;
create index if not exists notifications_broadcast_idx on public.notifications(broadcast_id);

-- Өмнө нь илгээсэн зарлалуудыг түүхэнд оруулах (нэг удаа илгээсэн мөрүүд ижил цагтай)
with g as (
  select title, body, created_at, count(*)::int as n
  from public.notifications
  where type = 'broadcast' and broadcast_id is null
  group by title, body, created_at
), ins as (
  insert into public.broadcasts(title, body, created_at, recipients)
  select title, body, created_at, n from g
  returning id, title, body, created_at
)
update public.notifications x set broadcast_id = ins.id
from ins
where x.type = 'broadcast' and x.broadcast_id is null
  and x.title = ins.title and x.body is not distinct from ins.body and x.created_at = ins.created_at;

-- Зарлал илгээх
create or replace function public.broadcast(p_title text, p_body text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int; bid uuid;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Гарчиг хоосон байна'; end if;
  insert into public.broadcasts(title, body, created_by)
  values (trim(p_title), nullif(trim(p_body), ''), auth.uid())
  returning id into bid;
  insert into public.notifications(user_id, type, title, body, broadcast_id)
  select p.id, 'broadcast', trim(p_title), nullif(trim(p_body), ''), bid
  from public.profiles p where not p.is_blocked;
  get diagnostics n = row_count;
  update public.broadcasts set recipients = n where id = bid;
  perform public.log_action('Зарлал илгээв: ' || trim(p_title));
  return n;
end $$;

-- Зарлалын жагсаалт (уншсан тоотой)
create or replace function public.broadcast_list() returns table(
  id uuid, title text, body text, created_at timestamptz, recipients int, read_count int, author text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  return query
    select b.id, b.title, b.body, b.created_at, b.recipients,
           (select count(*)::int from public.notifications x where x.broadcast_id = b.id and x.read),
           coalesce(p.full_name, p.email)
    from public.broadcasts b
    left join public.profiles p on p.id = b.created_by
    order by b.created_at desc
    limit 200;
end $$;

-- Устгах: бүх хэрэглэгчийн мэдэгдлээс хамт устна
create or replace function public.delete_broadcast(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  delete from public.broadcasts where id = p_id returning title into t;
  if t is null then raise exception 'Зарлал олдсонгүй'; end if;
  perform public.log_action('Зарлал устгав: ' || t);
end $$;

-- Дахин илгээх
create or replace function public.resend_broadcast(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare b public.broadcasts;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into b from public.broadcasts where id = p_id;
  if b.id is null then raise exception 'Зарлал олдсонгүй'; end if;
  return public.broadcast(b.title, b.body);
end $$;

revoke execute on function public.broadcast_list() from public, anon;
revoke execute on function public.delete_broadcast(uuid) from public, anon;
revoke execute on function public.resend_broadcast(uuid) from public, anon;
revoke execute on function public.broadcast(text, text) from public, anon;
grant execute on function public.broadcast_list() to authenticated;
grant execute on function public.delete_broadcast(uuid) to authenticated;
grant execute on function public.resend_broadcast(uuid) to authenticated;
grant execute on function public.broadcast(text, text) to authenticated;

-- Админы дэлгэц шууд шинэчлэгдэх
drop trigger if exists mz_sync_broadcasts on public.broadcasts;
create trigger mz_sync_broadcasts after insert or update or delete on public.broadcasts
for each row execute function public.mz_broadcast();

-- API-ийн кэшийг шинэчлэх (хүснэгтүүд шууд харагдана)
notify pgrst, 'reload schema';

-- =====================================================================
-- ЭХНИЙ АДМИН: доорх мөрөнд өөрийн Google и-мэйлийг бичээд ажиллуулна.
-- (Нэвтрэхээсээ өмнө эсвэл дараа ажиллуулж болно.)
-- =====================================================================
-- insert into public.staff_invites(email, role) values ('таны_имэйл@gmail.com', 'admin') on conflict (email) do update set role = 'admin';
-- update public.profiles set role = 'admin' where lower(email) = lower('таны_имэйл@gmail.com');
