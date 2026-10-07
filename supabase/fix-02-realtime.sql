-- =====================================================================
-- ЗАСВАР 02: Бүх өөрчлөлт шууд (realtime) харагдах + Апп татах холбоос
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

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

notify pgrst, 'reload schema';
