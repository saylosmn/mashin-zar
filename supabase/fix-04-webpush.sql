-- =====================================================================
-- ЗАСВАР 04: Вэб push (iPhone-ийн нүүр дэлгэцэнд суулгасан сайт, Android Chrome, компьютер)
--   * web_push_subs: хөтөч бүрийн мэдэгдлийн захиалга
--   * notify_push: Expo (Android апп) + вэб push хоёуланд нь илгээнэ
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

create extension if not exists pg_net;

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

notify pgrst, 'reload schema';
