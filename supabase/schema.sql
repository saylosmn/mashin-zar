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

-- ---------------------------------------------------------------------
-- Гэрээ, шимтгэл, борлуулалтын тайлан
-- ---------------------------------------------------------------------
-- ---------- Тохиргоо ----------
alter table public.settings add column if not exists company_name text not null default 'Autoshop ХХК';
alter table public.settings add column if not exists commission_tiers jsonb not null
  default '[{"days":2,"percent":3},{"days":7,"percent":2},{"days":10,"percent":1.5}]'::jsonb;
alter table public.settings add column if not exists commission_after numeric(5,2) not null default 1.5;

create or replace function public.update_contract_settings(p_company text, p_tiers jsonb, p_after numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if coalesce(trim(p_company), '') = '' then raise exception 'Компанийн нэр хоосон байна'; end if;
  if jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then raise exception 'Шимтгэлийн шат буруу'; end if;
  update public.settings set company_name = trim(p_company),
    commission_tiers = (select jsonb_agg(jsonb_build_object('days', (e->>'days')::int, 'percent', (e->>'percent')::numeric) order by (e->>'days')::int)
                        from jsonb_array_elements(p_tiers) e),
    commission_after = coalesce(p_after, 0), updated_at = now()
  where id = 1;
  perform public.log_action('Гэрээний нөхцөл өөрчиллөө');
end $$;

-- ---------- Гэрээ ----------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ad_id uuid references public.ads(id) on delete set null,
  company_name text not null,
  terms jsonb not null,               -- {"tiers":[...], "after":1.5}
  full_name text not null,
  phone text not null,
  brand text not null,
  model text not null,
  year_made int,
  plate_number text not null,
  vin text not null,
  price bigint not null,
  signature_svg text not null,        -- гарын үсэг: SVG path (600x200 талбайд)
  user_agent text,
  pdf_path text,                      -- storage: contracts/<user_id>/<id>.pdf
  signed_at timestamptz not null default now()
);
create index if not exists contracts_user_idx on public.contracts(user_id, signed_at desc);
create index if not exists contracts_ad_idx on public.contracts(ad_id);
alter table public.contracts enable row level security;
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select using (user_id = auth.uid() or public.is_staff());
grant select on public.contracts to authenticated;

alter table public.ads add column if not exists contract_id uuid references public.contracts(id) on delete set null;
create unique index if not exists ads_contract_uidx on public.ads(contract_id) where contract_id is not null;

-- Гэрээ байгуулах (гарын үсэгтэй). Зар оруулахын өмнө дуудна.
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
  select * into s from public.settings where id = 1;
  insert into public.contracts(user_id, company_name, terms, full_name, phone, brand, model, year_made,
                               plate_number, vin, price, signature_svg, user_agent)
  values (auth.uid(), s.company_name, jsonb_build_object('tiers', s.commission_tiers, 'after', s.commission_after),
          trim(p_full_name), trim(p_phone), trim(p_brand), trim(p_model), p_year,
          upper(trim(p_plate)), upper(trim(p_vin)), p_price, p_signature, left(p_ua, 200))
  returning id into cid;
  return cid;
end $$;

create or replace function public.set_contract_pdf(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.contracts set pdf_path = p_path
  where id = p_id and (user_id = auth.uid() or public.is_staff());
end $$;

-- Зар үүсэхэд гэрээг тухайн зартай холбоно
create or replace function public.ads_link_contract() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.contract_id is not null then
    update public.contracts set ad_id = new.id where id = new.contract_id;
  end if;
  return null;
end $$;
drop trigger if exists ads_link_contract on public.ads;
create trigger ads_link_contract after insert on public.ads
for each row execute function public.ads_link_contract();

-- Шинэ зар заавал гэрээтэй (өөрийн, ашиглагдаагүй гэрээ)
drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and manager_id is null and offer_amount is null and sold_at is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_blocked and p.profile_completed)
  and contract_id is not null
  and exists (select 1 from public.contracts c where c.id = contract_id and c.user_id = auth.uid() and c.ad_id is null)
);

-- ---------- Шимтгэл тооцох ----------
-- Зар нийтлэгдсэнээс (approved_at) зарагдах хүртэлх хугацаагаар
create or replace function public.commission_for(p_ad uuid, p_sold_at timestamptz default now())
returns table(days int, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare a public.ads; t jsonb; aft numeric; hrs numeric; e jsonb;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
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

-- ---------- Борлуулалтын тайлан ----------
create table if not exists public.sale_reports (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  sold_price bigint not null check (sold_price > 0),
  sold_at timestamptz not null,
  buyer_name text,
  buyer_phone text,
  note text,
  days_on_market int not null,
  commission_percent numeric(5,2) not null,
  commission_amount bigint not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sale_reports_status_idx on public.sale_reports(status, created_at desc);
create unique index if not exists sale_reports_ad_open_uidx on public.sale_reports(ad_id) where status <> 'rejected';
alter table public.sale_reports enable row level security;
drop policy if exists sale_reports_read on public.sale_reports;
create policy sale_reports_read on public.sale_reports for select using (manager_id = auth.uid() or public.is_admin());
grant select on public.sale_reports to authenticated;

-- Менежер: "Энэ машиныг зарсан" тайлан илгээх
create or replace function public.submit_sale_report(
  p_ad uuid, p_price bigint, p_sold_at timestamptz default now(),
  p_buyer_name text default null, p_buyer_phone text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; c record; rid uuid; amt bigint; me public.profiles;
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
  insert into public.sale_reports(ad_id, manager_id, sold_price, sold_at, buyer_name, buyer_phone, note,
                                  days_on_market, commission_percent, commission_amount)
  values (p_ad, auth.uid(), p_price, coalesce(p_sold_at, now()), nullif(trim(p_buyer_name), ''),
          nullif(trim(p_buyer_phone), ''), nullif(trim(p_note), ''), c.days, c.percent, amt)
  returning id into rid;
  select * into me from public.profiles where id = auth.uid();
  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'sale_report', 'Шинэ тайлан: ' || a.brand || ' ' || a.model || ' зарагдлаа',
         coalesce(me.full_name, me.email, 'Менежер') || ' · ' || to_char(p_price, 'FM999,999,999,999') || '₮ · '
         || c.days || ' хоног · шимтгэл ' || c.percent || '% = ' || to_char(amt, 'FM999,999,999,999') || '₮',
         a.id
  from public.profiles p where p.role = 'admin' and not p.is_blocked and p.id <> auth.uid();
  perform public.log_action('Тайлан илгээв: ' || a.brand || ' ' || a.model || ' зарагдсан', a.id);
  return rid;
end $$;

-- Админ: тайлан батлах / буцаах. Батлахад зар "зарагдсан" болно.
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
            a.brand || ' ' || a.model || coalesce(' · ' || nullif(trim(p_note), ''), ''), a.id);
  end if;
  perform public.log_action(case when p_approve then 'Тайлан баталлаа: ' else 'Тайлан буцаалаа: ' end || a.brand || ' ' || a.model, a.id);
end $$;

-- ---------- Эрх ----------
revoke execute on function public.update_contract_settings(text, jsonb, numeric) from public, anon;
revoke execute on function public.sign_contract(text, text, text, text, int, text, text, bigint, text, text) from public, anon;
revoke execute on function public.set_contract_pdf(uuid, text) from public, anon;
revoke execute on function public.commission_for(uuid, timestamptz) from public, anon;
revoke execute on function public.submit_sale_report(uuid, bigint, timestamptz, text, text, text) from public, anon;
revoke execute on function public.review_sale_report(uuid, boolean, text) from public, anon;
grant execute on function public.update_contract_settings(text, jsonb, numeric) to authenticated;
grant execute on function public.sign_contract(text, text, text, text, int, text, text, bigint, text, text) to authenticated;
grant execute on function public.set_contract_pdf(uuid, text) to authenticated;
grant execute on function public.commission_for(uuid, timestamptz) to authenticated;
grant execute on function public.submit_sale_report(uuid, bigint, timestamptz, text, text, text) to authenticated;
grant execute on function public.review_sale_report(uuid, boolean, text) to authenticated;

-- ---------- Гэрээний PDF хадгалах сан (хувийн) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "contracts read" on storage.objects;
create policy "contracts read" on storage.objects for select to authenticated
  using (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "contracts upload" on storage.objects;
create policy "contracts upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "contracts update" on storage.objects;
create policy "contracts update" on storage.objects for update to authenticated
  using (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- Push мэдэгдлийн холбоос (тайлангийн шинэ төрлүүд) ----------
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
                    when r.type = 'sale_report' then '/admin/reports'
                    when r.type = 'report_reviewed' then '/manager/reports'
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

-- ---------- Шууд шинэчлэл ----------
drop trigger if exists mz_sync_reports on public.sale_reports;
create trigger mz_sync_reports after insert or update or delete on public.sale_reports
for each row execute function public.mz_broadcast();

-- ---------------------------------------------------------------------
-- Авто худалдаа (байнгын харилцагч)
-- ---------------------------------------------------------------------
-- ---------- Эрх, төлөв ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','manager','admin','dealer'));
alter table public.profiles add column if not exists shop_name text;

alter table public.staff_invites drop constraint if exists staff_invites_role_check;
alter table public.staff_invites add constraint staff_invites_role_check check (role in ('manager','admin','dealer'));
alter table public.staff_invites add column if not exists shop_name text;

alter table public.ads drop constraint if exists ads_status_check;
alter table public.ads add constraint ads_status_check check (status in ('pending','active','sold','rejected','hidden'));

-- Шинэ хэрэглэгч бүртгүүлэхэд урилгаас эрх, дэлгүүрийн нэрийг авна
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.staff_invites;
begin
  select * into inv from public.staff_invites where lower(email) = lower(new.email);
  insert into public.profiles (id, email, full_name, avatar_url, role, phone, shop_name)
  values (
    new.id,
    new.email,
    coalesce(inv.full_name, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(inv.role, 'user'),
    inv.phone,
    inv.shop_name
  )
  on conflict (id) do nothing;
  insert into public.activity_log(actor_id, action) values (new.id, 'Шинэ хэрэглэгч бүртгүүлэв: ' || coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

-- ---------- Админ: авто худалдаа нэмэх / хасах ----------
create or replace function public.invite_dealer(p_email text, p_shop text, p_phone text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if e !~ '^\S+@\S+\.\S+$' then raise exception 'И-мэйл буруу байна'; end if;
  if coalesce(trim(p_shop), '') = '' then raise exception 'Авто худалдааны нэрийг оруулна уу'; end if;
  if exists (select 1 from public.profiles where lower(email) = e and role in ('manager','admin')) then
    raise exception 'Энэ хүн менежер/админ эрхтэй байна';
  end if;
  insert into public.staff_invites(email, role, full_name, phone, shop_name) values (e, 'dealer', null, p_phone, trim(p_shop))
  on conflict (email) do update set role = 'dealer', shop_name = excluded.shop_name, phone = coalesce(excluded.phone, staff_invites.phone);
  update public.profiles set role = 'dealer', shop_name = trim(p_shop), is_blocked = false, phone = coalesce(phone, p_phone)
  where lower(email) = e;
  perform public.log_action('Админ: ' || e || ' → Авто худалдаа (' || trim(p_shop) || ')');
end $$;

create or replace function public.remove_dealer(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.profiles set role = 'user' where id = p_user and role = 'dealer' returning * into pr;
  if pr.id is null then raise exception 'Авто худалдааны эрхтэй хэрэглэгч олдсонгүй'; end if;
  delete from public.staff_invites where lower(email) = lower(pr.email) and role = 'dealer';
  perform public.log_action('Админ: ' || coalesce(pr.shop_name, pr.email) || '-ийн авто худалдааны эрхийг хаслаа');
end $$;

-- ---------- Зар оруулах: авто худалдаа гэрээгүй, шууд нийтлэгдэнэ ----------
drop policy if exists ads_insert on public.ads;
-- (RLS нь BEFORE trigger-ийн дараах мөрийг шалгадаг: авто худалдааны зар тэр үед аль хэдийн 'active' болсон байна)
create policy ads_insert on public.ads for insert with check (
  user_id = auth.uid()
  and (status = 'pending' or (status = 'active' and public.my_role() = 'dealer'))
  and manager_id is null and offer_amount is null and sold_at is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_blocked and p.profile_completed)
  and (
    public.my_role() = 'dealer'
    or (contract_id is not null
        and exists (select 1 from public.contracts c where c.id = contract_id and c.user_id = auth.uid() and c.ad_id is null))
  )
);

create or replace function public.ads_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare cutoff int;
begin
  select cutoff_year into cutoff from public.settings where id = 1;
  new.category := case when new.year_made >= coalesce(cutoff, 2016) then 'new' else 'old' end;
  new.updated_at := now();
  -- Авто худалдааны шинэ зар шууд нийтлэгдэнэ
  if tg_op = 'INSERT' and new.status = 'pending'
     and exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'dealer' and not p.is_blocked) then
    new.status := 'active';
    new.approved_at := now();
  end if;
  return new;
end $$;

create or replace function public.ads_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.settings;
begin
  select * into s from public.settings where id = 1;
  if new.status = 'active' then
    -- Авто худалдааны зар: шууд нийтлэгдсэн тул хэрэглэгчдэд "шинэ зар" мэдэгдэл
    if s.notify_all_on_approve then
      insert into public.notifications(user_id, type, title, body, ad_id)
      select p.id, 'new_ad', 'Шинэ зар',
             new.brand || ' ' || new.model || ' · ' || new.year_made || ' · ' || to_char(new.price, 'FM999,999,999,999') || '₮', new.id
      from public.profiles p
      where p.id <> new.user_id and not p.is_blocked and p.notify_new_ads
        and (p.notify_category is null or p.notify_category = new.category)
        and (p.notify_brand is null or lower(p.notify_brand) = lower(new.brand))
        and (p.notify_max_price is null or new.price <= p.notify_max_price);
    end if;
  elsif s.notify_staff_on_new then
    insert into public.notifications(user_id, type, title, body, ad_id)
    select p.id, 'staff_new_ad', 'Шинэ зар ирлээ',
           new.brand || ' ' || new.model || ' · ' || new.year_made || ' · ' || to_char(new.price, 'FM999,999,999,999') || '₮',
           new.id
    from public.profiles p where p.role in ('manager','admin') and not p.is_blocked;
  end if;
  insert into public.activity_log(actor_id, action, ad_id)
  values (new.user_id, new.brand || ' ' || new.model || ' зар ' || case when new.status = 'active' then 'нийтлэв (авто худалдаа)' else 'илгээгдэв' end, new.id);
  return new;
end $$;

-- Нуусан зарыг эзэн нь устгаж болно
drop policy if exists ads_delete on public.ads;
create policy ads_delete on public.ads for delete using (
  public.is_admin()
  or (user_id = auth.uid() and status in ('pending','active','rejected','hidden'))
);

-- ---------- Авто худалдаа: өөрийн зарыг засах ----------
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

revoke execute on function public.invite_dealer(text, text, text) from public, anon;
revoke execute on function public.remove_dealer(uuid) from public, anon;
revoke execute on function public.dealer_update_ad(uuid, jsonb) from public, anon;
revoke execute on function public.dealer_set_status(uuid, text, bigint) from public, anon;
grant execute on function public.invite_dealer(text, text, text) to authenticated;
grant execute on function public.remove_dealer(uuid) to authenticated;
grant execute on function public.dealer_update_ad(uuid, jsonb) to authenticated;
grant execute on function public.dealer_set_status(uuid, text, bigint) to authenticated;

-- ---------- Нийтийн зарт дэлгүүрийн нэр ----------
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
where a.status = 'active';
grant select on public.public_ads to anon, authenticated;

-- ---------------------------------------------------------------------
-- Лизингийн түншлэл
-- ---------------------------------------------------------------------
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

-- API-ийн кэшийг шинэчлэх (хүснэгтүүд шууд харагдана)
-- ---------- Лизингийн шаардлага, анкет, баримт (fix-09) ----------
-- ---------- Түншийн шаардлага ----------
alter table public.leasing_partners add column if not exists min_age int not null default 18;
alter table public.leasing_partners add column if not exists max_age int not null default 65;
alter table public.leasing_partners add column if not exists min_work_months int not null default 6;
alter table public.leasing_partners add column if not exists min_business_months int not null default 12;
alter table public.leasing_partners add column if not exists max_dti numeric(5,2) not null default 50;
alter table public.leasing_partners add column if not exists min_car_year int;
alter table public.leasing_partners add column if not exists cosigner_over bigint;
alter table public.leasing_partners add column if not exists required_docs text[] not null default array['id_front','id_back','ndsh','bank_statement'];
alter table public.leasing_partners add column if not exists requirements_note text;

-- ---------- Хүсэлтийн анкет ----------
alter table public.loan_requests add column if not exists applicant jsonb not null default '{}'::jsonb;
alter table public.loan_requests add column if not exists docs jsonb not null default '{}'::jsonb;
alter table public.loan_requests add column if not exists checks jsonb not null default '[]'::jsonb;
alter table public.loan_requests add column if not exists checks_ok boolean;
alter table public.loan_requests add column if not exists dti numeric(6,2);

-- Баримтын төрлүүд (вэб/апп-ын LOAN_DOCS-тэй ижил)
create or replace function public.loan_doc_kinds() returns text[]
language sql immutable as $$
  select array['id_front','id_back','ndsh','bank_statement','address','employment','business','license','photo','credit','cosigner_id']
$$;

-- Регистрийн дугаараас төрсөн огноо (АА00000000; 2000 оноос хойш төрсөн бол сар +20). Буруу бол null.
create or replace function public.rd_birth_date(p_rd text) returns date
language plpgsql immutable as $$
declare r text := upper(regexp_replace(coalesce(p_rd, ''), '\s', '', 'g')); y int; m int; d int;
begin
  if r !~ '^[А-ЯЁӨҮ]{2}[0-9]{8}$' then return null; end if;
  y := substr(r, 3, 2)::int; m := substr(r, 5, 2)::int; d := substr(r, 7, 2)::int;
  if m > 20 then y := 2000 + y; m := m - 20; else y := 1900 + y; end if;
  return make_date(y, m, d);
exception when others then return null;
end $$;

-- ---------- Баримтын хувийн сан ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loan-docs', 'loan-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "loan docs upload" on storage.objects;
create policy "loan docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'loan-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "loan docs delete" on storage.objects;
create policy "loan docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'loan-docs' and (storage.foldername(name))[1] = auth.uid()::text);
-- Унших: өөрөө, админ, эсвэл тухайн хүсэлтийг хүлээн авсан лизингийн компанийн ажилтан
drop policy if exists "loan docs read" on storage.objects;
create policy "loan docs read" on storage.objects for select to authenticated
  using (bucket_id = 'loan-docs' and (
    (storage.foldername(objects.name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.loan_requests r, jsonb_each_text(r.docs) d
               where r.partner_id = public.my_partner() and d.value = objects.name)
  ));

-- ---------- Хүсэлт илгээх (анкеттай) ----------
drop function if exists public.submit_loan_request(uuid, uuid, text, text, bigint, int, text, text, boolean);

create or replace function public.submit_loan_request(
  p_ad uuid, p_partner uuid, p_down bigint, p_term int, p_app jsonb, p_docs jsonb, p_consent boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.ads; lp public.leasing_partners; me public.profiles; rid uuid; m bigint;
  v_name text := trim(coalesce(p_app->>'full_name', ''));
  v_phone text := trim(coalesce(p_app->>'phone', ''));
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
      if k = any(public.loan_doc_kinds()) and pth like auth.uid()::text || '/%'
         and exists (select 1 from storage.objects o where o.bucket_id = 'loan-docs' and o.name = pth) then
        v_docs := v_docs || jsonb_build_object(k, pth);
      end if;
    end loop;
  end if;
  foreach k in array lp.required_docs loop
    if k = 'cosigner_id' and v_cos is null then continue; end if;
    if not v_docs ? k then raise exception 'Шаардлагатай баримт дутуу байна: %', k; end if;
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
    'city', trim(p_app->>'city'), 'district', nullif(trim(p_app->>'district'), ''), 'address', trim(p_app->>'address'),
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
          a.price, p_down, p_term, lp.rate_annual, m, to_char(v_income, 'FM999,999,999,999') || '₮', nullif(trim(p_app->>'note'), ''), true,
          v_app, v_docs, v_checks, ok, v_dti)
  returning id into rid;

  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'loan_request', 'Лизингийн шинэ хүсэлт' || case when ok then ' ✓' else '' end,
         v_name || ' · ' || a.brand || ' ' || a.model || ' · ' || to_char(v_loan, 'FM999,999,999,999') || '₮, ' || p_term || ' сар',
         a.id
  from public.profiles p
  where not p.is_blocked and ((p.role = 'leasing' and p.partner_id = lp.id) or p.role = 'admin');
  perform public.log_action('Лизингийн хүсэлт: ' || a.brand || ' ' || a.model || ' → ' || lp.name, a.id);
  return rid;
end $$;

-- ---------- Нөхцөл, шаардлага тохируулах (түншийн ажилтан эсвэл админ) ----------
drop function if exists public.set_partner_terms(numeric, numeric, int);

create or replace function public.set_partner_terms(p_partner uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rate numeric; v_down numeric; v_term int; v_min_age int; v_max_age int; v_work int; v_bus int;
  v_dti numeric; v_car int; v_cos bigint; v_docs text[];
begin
  begin
    v_rate := (p->>'rate_annual')::numeric;
    v_down := (p->>'min_down_pct')::numeric;
    v_term := (p->>'max_term_months')::int;
    v_min_age := (p->>'min_age')::int;
    v_max_age := (p->>'max_age')::int;
    v_work := (p->>'min_work_months')::int;
    v_bus := (p->>'min_business_months')::int;
    v_dti := (p->>'max_dti')::numeric;
    v_car := nullif(p->>'min_car_year', '')::int;
    v_cos := nullif(p->>'cosigner_over', '')::bigint;
  exception when others then
    raise exception 'Тоон утга буруу байна';
  end;
  if p_partner is null or not (public.is_admin() or coalesce(p_partner = public.my_partner(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if v_rate is null or v_rate < 0 or v_rate > 100 then raise exception 'Жилийн хүү 0–100%% байна'; end if;
  if v_down is null or v_down < 0 or v_down >= 100 then raise exception 'Урьдчилгаа 0–99%% байна'; end if;
  if v_term is null or v_term not between 1 and 120 then raise exception 'Хугацаа 1–120 сар байна'; end if;
  if v_min_age is null or v_max_age is null or v_min_age < 16 or v_max_age > 100 or v_min_age > v_max_age then raise exception 'Насны хязгаар буруу байна'; end if;
  if v_work is null or v_work not between 0 and 240 or v_bus is null or v_bus not between 0 and 240 then raise exception 'Ажилласан хугацаа 0–240 сар байна'; end if;
  if v_dti is null or v_dti <= 0 or v_dti > 100 then raise exception 'Өр/орлогын харьцаа 1–100%% байна'; end if;
  if v_car is not null and v_car not between 1950 and 2100 then raise exception 'Машины он буруу байна'; end if;
  if v_cos is not null and v_cos < 0 then raise exception 'Хамтран зээлдэгчийн босго буруу байна'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_docs
  from jsonb_array_elements_text(coalesce(p->'required_docs', '[]'::jsonb)) x where x = any(public.loan_doc_kinds());
  update public.leasing_partners set
    rate_annual = v_rate, min_down_pct = v_down, max_term_months = v_term,
    min_age = v_min_age, max_age = v_max_age, min_work_months = v_work, min_business_months = v_bus,
    max_dti = v_dti, min_car_year = v_car, cosigner_over = v_cos, required_docs = v_docs,
    requirements_note = nullif(trim(p->>'requirements_note'), ''), updated_at = now()
  where id = p_partner;
  if not found then raise exception 'Компани олдсонгүй'; end if;
end $$;

revoke execute on function public.submit_loan_request(uuid, uuid, bigint, int, jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.set_partner_terms(uuid, jsonb) from public, anon;
grant execute on function public.submit_loan_request(uuid, uuid, bigint, int, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.set_partner_terms(uuid, jsonb) to authenticated;
grant execute on function public.rd_birth_date(text) to authenticated;
grant execute on function public.loan_doc_kinds() to anon, authenticated;

-- ---------- Аюулгүй байдал + лизингийн аудит (fix-10) ----------
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

-- ---------- Realtime: хувийн сувгууд (fix-11) ----------
create or replace function public.mz_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb; o jsonb; payload jsonb; st text; ost text; uid text; pid text;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    -- Зөвхөн үзэлтийн тоо өөрчлөгдсөн бол дохио илгээхгүй
    if (rec - 'views' - 'updated_at') = (o - 'views' - 'updated_at') then return null; end if;
  end if;
  payload := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', rec->>'id');
  st := rec->>'status';
  ost := o->>'status';
  if tg_table_name = 'ads' then payload := payload || jsonb_build_object('status', st); end if;

  begin
    -- Нийтийн: нийтэд харагдах (эсвэл саяхан харагдаж байсан) зар, лизингийн нөхцөл, тохиргоо
    if (tg_table_name = 'ads' and (st in ('active','sold') or ost in ('active','sold')))
       or tg_table_name in ('leasing_partners','settings') then
      perform realtime.send(payload, 'change', 'mz-sync', false);
    end if;
    -- Менежер, админ
    perform realtime.send(payload, 'change', 'mz-staff', true);
    -- Эзэмшигч хэрэглэгч
    uid := case tg_table_name
             when 'ads' then rec->>'user_id'
             when 'loan_requests' then rec->>'user_id'
             when 'profiles' then rec->>'id'
             when 'sale_reports' then rec->>'manager_id'
           end;
    if uid is not null then perform realtime.send(payload, 'change', 'u:' || uid, true); end if;
    -- Лизингийн компани
    pid := case tg_table_name
             when 'loan_requests' then rec->>'partner_id'
             when 'leasing_partners' then rec->>'id'
           end;
    if pid is not null then perform realtime.send(payload, 'change', 'p:' || pid, true); end if;
  exception when others then
    -- realtime ажиллахгүй үед өгөгдөл бичих үйлдлийг саатуулахгүй
    null;
  end;
  return null;
end $$;
revoke execute on function public.mz_broadcast() from public, anon, authenticated;

-- Хувийн сувгийг хэн сонсох вэ (realtime.messages дээрх RLS)
do $$
begin
  execute 'drop policy if exists "mz private channels" on realtime.messages';
  execute $p$
    create policy "mz private channels" on realtime.messages for select to authenticated
    using (
      realtime.messages.extension = 'broadcast' and (
        (realtime.topic() = 'mz-staff' and public.is_staff())
        or realtime.topic() = 'u:' || auth.uid()::text
        or (public.my_partner() is not null and realtime.topic() = 'p:' || public.my_partner()::text)
      )
    )
  $p$;
exception when others then
  raise notice 'realtime.messages policy: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- ЭХНИЙ АДМИН: доорх мөрөнд өөрийн Google и-мэйлийг бичээд ажиллуулна.
-- (Нэвтрэхээсээ өмнө эсвэл дараа ажиллуулж болно.)
-- =====================================================================
-- insert into public.staff_invites(email, role) values ('таны_имэйл@gmail.com', 'admin') on conflict (email) do update set role = 'admin';
-- update public.profiles set role = 'admin' where lower(email) = lower('таны_имэйл@gmail.com');
