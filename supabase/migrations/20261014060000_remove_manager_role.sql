-- Менежер эрхийг хасна (бүх ажлыг админ хийнэ). Зар/зургийн өдрийн лимит, эрх өөрчлөх хамгаалалт.

-- ---------- 1. Менежер эрх хасах ----------
update public.profiles set role = 'user' where role = 'manager';
delete from public.staff_invites where role = 'manager';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','admin','dealer','leasing','agent'));
alter table public.staff_invites drop constraint if exists staff_invites_role_check;
alter table public.staff_invites add constraint staff_invites_role_check check (role in ('admin','dealer','leasing','agent'));

-- Ажилтан = зөвхөн админ (RLS, RPC бүгд энэ функцээр шалгадаг)
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- Админ нэмэх (Google и-мэйлээр). Менежер эрх байхгүй.
create or replace function public.invite_staff(p_email text, p_role text, p_name text default null, p_phone text default null) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if coalesce(p_role, 'admin') <> 'admin' then raise exception 'Буруу эрх: зөвхөн админ нэмнэ'; end if;
  if e !~ '^\S+@\S+\.\S+$' then raise exception 'И-мэйл буруу байна'; end if;
  insert into public.staff_invites(email, role, full_name, phone) values (e, 'admin', p_name, p_phone)
  on conflict (email) do update set role = 'admin', full_name = excluded.full_name, phone = excluded.phone,
    shop_name = null, partner_id = null;
  update public.profiles set role = 'admin', is_blocked = false,
    full_name = coalesce(full_name, p_name), phone = coalesce(phone, p_phone)
  where lower(email) = e;
  perform public.log_action('Админ: ' || e || ' → админ');
end $$;

create or replace function public.remove_staff(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_user = auth.uid() then raise exception 'Өөрийн эрхийг хасаж болохгүй'; end if;
  update public.profiles set role = 'user' where id = p_user and role = 'admin' returning * into pr;
  if pr.id is null then raise exception 'Админ олдсонгүй'; end if;
  delete from public.staff_invites where lower(email) = lower(pr.email) and role = 'admin';
  perform public.log_action('Админ: ' || coalesce(pr.full_name, pr.email) || '-ийн админ эрхийг хаслаа');
end $$;

-- ---------- 2. Push холбоос ----------
create or replace function public.notify_url(p_type text, p_ad uuid) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'message' then '/messages'
    when p_type in ('sale_report','report_reviewed') then '/admin/reports'
    when p_type = 'loan_request' then '/leasing'
    when p_type = 'loan_update' then '/loans'
    when p_type = 'agent_commission' then '/agent'
    when p_type in ('ad_expiring','ad_expired','featured_on') then '/my'
    when p_type = 'ad_flag' then '/admin/flags'
    when p_type = 'featured_request' then '/admin/ads?featured=1'
    when p_type = 'payment_submitted' then '/admin/payments'
    when p_type in ('payment_ok','payment_rejected') then coalesce('/pay/' || p_ad, '/my')
    when p_ad is null then '/notifications'
    when p_type = 'staff_new_ad' then '/admin/review?id=' || p_ad
    else '/ads/' || p_ad
  end
$$;

-- ---------- 3. Эрх өөрчлөх хамгаалалт ----------
-- Хэрэглэгч өөрийн профайлыг засахдаа role / is_blocked / агентын код / дэлгүүр / түншийг өөрчилж чадахгүй.
-- (security definer RPC-ууд auth.uid()-тэй ч админ шалгалт хийсний дараа өөрчилдөг тул админд зөвшөөрнө.)
create or replace function public.profiles_guard_privileged() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- SQL Editor / service_role (auth.uid() байхгүй) болон админ чөлөөтэй
  if auth.uid() is null or public.is_admin() then return new; end if;
  -- Шинэ хэрэглэгч бүртгэгдэх (handle_new_user урилгаар эрх олгоно) - insert-д хамаарахгүй
  if tg_op = 'UPDATE' and (
       new.role is distinct from old.role
    or new.is_blocked is distinct from old.is_blocked
    or new.agent_code is distinct from old.agent_code
    or new.partner_id is distinct from old.partner_id
  ) then
    -- Урилгаар эрх идэвхжих (handle_new_user / нэвтрэх үед) нь invite байгаа үед л
    if new.role is distinct from old.role and exists (
      select 1 from public.staff_invites i where lower(i.email) = lower(new.email) and i.role = new.role
    ) and new.id = auth.uid() then
      return new;
    end if;
    raise exception 'Эрх хүрэхгүй: аккаунтын эрхийг зөвхөн админ өөрчилнө';
  end if;
  return new;
end $$;
revoke execute on function public.profiles_guard_privileged() from public, anon, authenticated;
drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged before update on public.profiles
for each row execute function public.profiles_guard_privileged();

-- ---------- 4. Зар оруулах хурдны хязгаар (спам) ----------
create or replace function public.ads_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; n_day int; n_pending int;
begin
  if auth.uid() is null then return new; end if;
  r := public.my_role();
  if r = 'admin' then return new; end if;
  select count(*) into n_day from public.ads a where a.user_id = new.user_id and a.created_at > now() - interval '1 day';
  if n_day >= (case when r = 'dealer' then 100 else 10 end) then
    raise exception 'Өнөөдөр хэт олон зар оруулсан байна. Маргааш дахин оролдоно уу.';
  end if;
  if r <> 'dealer' then
    select count(*) into n_pending from public.ads a where a.user_id = new.user_id and a.status = 'pending';
    if n_pending >= 20 then raise exception 'Шалгагдаагүй зар хэт олон байна. Өмнөх зарууд шалгагдсаны дараа оруулна уу.'; end if;
  end if;
  return new;
end $$;
revoke execute on function public.ads_rate_limit() from public, anon, authenticated;
drop trigger if exists ads_rate_limit on public.ads;
create trigger ads_rate_limit before insert on public.ads
for each row execute function public.ads_rate_limit();

-- ---------- 5. Зургийн сан: төрөл ба өдрийн хязгаар ----------
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp'], file_size_limit = 8388608
where id = 'ad-photos';

create or replace function public.photo_quota_ok() returns boolean
language sql stable security definer set search_path = public, storage as $$
  select count(*) < case when public.my_role() in ('admin','dealer') then 800 else 150 end
  from storage.objects o
  where o.bucket_id = 'ad-photos'
    and (storage.foldername(o.name))[1] = auth.uid()::text
    and o.created_at > now() - interval '1 day'
$$;
revoke execute on function public.photo_quota_ok() from public, anon;
grant execute on function public.photo_quota_ok() to authenticated;

drop policy if exists "ad photos upload own" on storage.objects;
create policy "ad photos upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ad-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '\.(jpe?g|png|webp)$'
    and public.photo_quota_ok()
  );

notify pgrst, 'reload schema';
