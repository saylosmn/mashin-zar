-- Нэг төхөөрөмжөөр өөр аккаунт нэвтрэхэд push токеныг шилжүүлнэ, туршилтын мэдэгдэл.

-- Токеныг одоогийн хэрэглэгчид шилжүүлж хадгална
create or replace function public.save_push_token(p_token text, p_platform text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нэвтэрнэ үү'; end if;
  if coalesce(p_token, '') !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'Push токен буруу'; end if;
  delete from public.push_tokens where token = p_token and user_id <> auth.uid();
  insert into public.push_tokens(token, user_id, platform) values (p_token, auth.uid(), left(p_platform, 20))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, created_at = now();
end $$;

-- Гарахад токеныг устгана (дараагийн хэрэглэгчид бусдын мэдэгдэл очихгүй)
create or replace function public.remove_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid()
$$;

-- Өөртөө туршилтын мэдэгдэл
create or replace function public.test_push() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Нэвтэрнэ үү'; end if;
  if exists (select 1 from public.notifications where user_id = auth.uid() and type = 'test' and created_at > now() - interval '30 seconds') then
    raise exception 'Түр хүлээгээд дахин оролдоно уу';
  end if;
  select count(*) into n from public.push_tokens where user_id = auth.uid();
  insert into public.notifications(user_id, type, title, body)
  values (auth.uid(), 'test', 'Туршилтын мэдэгдэл ✓', 'Push мэдэгдэл ажиллаж байна.');
  return n;
end $$;

-- Админ: push илгээлтийн сүүлийн хариу (pg_net). Expo-гийн алдаа (InvalidCredentials, DeviceNotRegistered …) энд харагдана.
create or replace function public.push_debug() returns table(created timestamptz, status_code int, body text, error text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  return query execute
    'select created, status_code, left(content::text, 600), error_msg::text from net._http_response order by created desc limit 20';
exception when undefined_table or invalid_schema_name then
  return;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.save_push_token(text, text)', 'public.remove_push_token(text)', 'public.test_push()', 'public.push_debug()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Админ: бүртгэлтэй push төхөөрөмжийн тоо
create or replace function public.push_token_count() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  return (select count(*)::int from public.push_tokens);
end $$;
revoke execute on function public.push_token_count() from public, anon;
grant execute on function public.push_token_count() to authenticated;

notify pgrst, 'reload schema';
