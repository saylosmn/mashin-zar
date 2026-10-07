-- =====================================================================
-- ЗАСВАР 01: Хүснэгтийн эрх (GRANT) + профайл өөрөө үүсгэх эрх
-- Шинэ Supabase project-ууд хүснэгтэд автоматаар эрх өгдөггүй болсон тул
-- нэвтэрсний дараа профайл уншиж чадахгүй, нэвтрэх хуудас руу буцаад байсан.
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================
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

-- Trigger ажиллаагүй байж болзошгүй хэрэглэгчдэд профайл нөхөж үүсгэх
insert into public.profiles (id, email, full_name, avatar_url, role)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
       u.raw_user_meta_data->>'avatar_url',
       coalesce((select i.role from public.staff_invites i where lower(i.email) = lower(u.email)), 'user')
from auth.users u
on conflict (id) do nothing;

-- Урилгад байгаа и-мэйлүүдийн эрхийг шинэчлэх (админ болох мөр ажиллуулсан бол)
update public.profiles p set role = i.role
from public.staff_invites i where lower(i.email) = lower(p.email) and p.role <> i.role;
