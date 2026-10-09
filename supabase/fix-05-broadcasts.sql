-- =====================================================================
-- ЗАСВАР 05: Админы зарлалын удирдлага
--   * broadcasts: илгээсэн зарлал бүрийн түүх (хэдэн хүнд очсон, хэд уншсан)
--   * Зарлал устгахад бүх хэрэглэгчийн мэдэгдлийн жагсаалтаас хамт устна
--   * Дахин илгээх
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

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

notify pgrst, 'reload schema';
