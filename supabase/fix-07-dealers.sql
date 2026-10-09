-- =====================================================================
-- ЗАСВАР 07: "Авто худалдаа" (байнгын харилцагч) эрх
--   * Админ олгоно (и-мэйлээр, бүртгүүлээгүй байсан ч болно)
--   * Зар нь менежерийн шалгалтгүй, гэрээгүйгээр шууд нийтлэгдэнэ
--   * Зараа өөрөө засах, зарагдсан болгох, түр нуух/дахин гаргах
--   * Зар дээр дэлгүүрийн нэр харагдана
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

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
  if not (public.is_admin() or (public.my_role() = 'dealer' and a.user_id = auth.uid())) then raise exception 'Эрх хүрэхгүй'; end if;
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
  if not (public.is_admin() or (public.my_role() = 'dealer' and a.user_id = auth.uid())) then raise exception 'Эрх хүрэхгүй'; end if;
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

notify pgrst, 'reload schema';
