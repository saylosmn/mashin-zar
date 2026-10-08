-- =====================================================================
-- ЗАСВАР 03: Push мэдэгдэл өгөгдлийн сангаас шууд илгээгдэх
--   * notifications хүснэгтэд мөр нэмэгдэх бүрт (шинэ зар, батлагдсан, санал,
--     зарагдсан, админы зарлал ...) тухайн хүний утас руу Expo push явна.
--   * Апп, вэб аль нь ч үйлдэл хийсэн адилхан ажиллана.
--   * Админ бүх хэрэглэгчид зарлал (жишээ нь "Апп шинэчлэгдлээ") илгээж чадна.
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

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

notify pgrst, 'reload schema';
