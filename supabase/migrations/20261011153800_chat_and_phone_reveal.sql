-- Худалдагчийн утас зөвхөн нэвтэрсэн хүнд (хэн харсныг бүртгэнэ), худалдагч-худалдан авагчийн чат.

-- ---------- 1. Нийтийн зар: утасгүй ----------
drop view if exists public.public_ads;
create view public.public_ads as
select
  a.id, a.brand, a.model, a.trim,
  public.mask_plate(a.plate_number) as plate_masked,
  public.mask_vin(a.vin) as vin_masked,
  a.year_made, a.year_imported, a.options, a.modifications, a.description,
  a.price, a.photos, a.category, a.status, a.views, a.approved_at, a.created_at,
  a.user_id,
  split_part(coalesce(p.full_name, 'Хэрэглэгч'), ' ', 1) as seller_name,
  p.city as seller_city,
  (select count(*) from public.ads x where x.user_id = a.user_id and x.status in ('active','sold'))::int as seller_ad_count,
  case when p.role = 'dealer' then coalesce(p.shop_name, 'Авто худалдаа') end as seller_shop,
  coalesce(a.featured_until > now(), false) as featured,
  a.expires_at
from public.ads a
join public.profiles p on p.id = a.user_id
where a.status = 'active' and not p.is_blocked and (a.expires_at is null or a.expires_at > now());
grant select on public.public_ads to anon, authenticated;

-- ---------- 2. Утас харсан бүртгэл ----------
create table if not exists public.ad_phone_views (
  ad_id uuid not null references public.ads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  times int not null default 1,
  primary key (ad_id, user_id)
);
create index if not exists ad_phone_views_user_idx on public.ad_phone_views(user_id, last_at desc);
alter table public.ad_phone_views enable row level security;
drop policy if exists phone_views_staff on public.ad_phone_views;
create policy phone_views_staff on public.ad_phone_views for select using (public.is_staff());
grant select on public.ad_phone_views to authenticated;

-- Нэвтэрсэн хэрэглэгч утсыг харна. Өдөрт 60 өөр зараас илүүг харахгүй (бот, хуулбарлахаас сэргийлнэ).
create or replace function public.reveal_phone(p_ad uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.ads; me public.profiles; n int;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Утас харахын тулд нэвтэрнэ үү'; end if;
  if me.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if a.user_id = auth.uid() or public.is_staff() then return a.phone; end if;
  if a.status <> 'active' or (a.expires_at is not null and a.expires_at <= now()) then raise exception 'Зар идэвхтэй биш байна'; end if;
  if not exists (select 1 from public.ad_phone_views v where v.ad_id = p_ad and v.user_id = auth.uid()) then
    select count(*) into n from public.ad_phone_views v where v.user_id = auth.uid() and v.first_at > now() - interval '1 day';
    if n >= 60 then raise exception 'Өнөөдөр хэт олон зарын утас харсан байна. Маргааш дахин оролдоно уу.'; end if;
  end if;
  insert into public.ad_phone_views(ad_id, user_id) values (p_ad, auth.uid())
  on conflict (ad_id, user_id) do update set last_at = now(), times = ad_phone_views.times + 1;
  return a.phone;
end $$;

-- ---------- 3. Чат ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid references public.ads(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  car text not null,                      -- "Toyota Prius · 2018" (зар устсан ч харагдана)
  last_message text,
  last_message_at timestamptz not null default now(),
  last_sender_id uuid,
  buyer_unread int not null default 0,
  seller_unread int not null default 0,
  created_at timestamptz not null default now(),
  constraint conv_parties check (buyer_id <> seller_id)
);
create unique index if not exists conversations_ad_buyer_uidx on public.conversations(ad_id, buyer_id) where ad_id is not null;
create index if not exists conversations_buyer_idx on public.conversations(buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations(seller_id, last_message_at desc);
alter table public.conversations enable row level security;
drop policy if exists conv_read on public.conversations;
create policy conv_read on public.conversations for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_staff());
grant select on public.conversations to authenticated;

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, id);
create index if not exists messages_sender_idx on public.messages(sender_id, created_at desc);
alter table public.messages enable row level security;
drop policy if exists msg_read on public.messages;
create policy msg_read on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = messages.conversation_id
          and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_staff()))
);
grant select on public.messages to authenticated;

-- Мессеж илгээх (дотоод): хязгаар, тоолуур, мэдэгдэл
create or replace function public.chat_post(p_conv uuid, p_body text) returns bigint
language plpgsql security definer set search_path = public as $$
declare c public.conversations; me public.profiles; other uuid; mid bigint; txt text := btrim(coalesce(p_body, ''));
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Нэвтэрнэ үү'; end if;
  if me.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if txt = '' then raise exception 'Мессеж хоосон байна'; end if;
  if char_length(txt) > 1000 then raise exception 'Мессеж 1000 тэмдэгтээс урт байна'; end if;
  select * into c from public.conversations where id = p_conv for update;
  if c.id is null or auth.uid() not in (c.buyer_id, c.seller_id) then raise exception 'Чат олдсонгүй'; end if;
  other := case when auth.uid() = c.buyer_id then c.seller_id else c.buyer_id end;
  if exists (select 1 from public.profiles p where p.id = other and p.is_blocked) then raise exception 'Энэ хэрэглэгчийн аккаунт хаагдсан байна'; end if;
  if (select count(*) from public.messages m where m.sender_id = auth.uid() and m.created_at > now() - interval '1 hour') >= 120 then
    raise exception 'Хэт олон мессеж илгээлээ. Түр хүлээгээд дахин оролдоно уу.';
  end if;
  insert into public.messages(conversation_id, sender_id, body) values (c.id, auth.uid(), txt) returning id into mid;
  update public.conversations set last_message = left(txt, 140), last_message_at = now(), last_sender_id = auth.uid(),
    buyer_unread = case when other = c.buyer_id then buyer_unread + 1 else 0 end,
    seller_unread = case when other = c.seller_id then seller_unread + 1 else 0 end
  where id = c.id;
  -- Мэдэгдэл (push): нэг чатаас 10 минутад нэг удаа
  if not exists (select 1 from public.notifications n where n.user_id = other and n.type = 'message' and not n.read
                 and n.ad_id is not distinct from c.ad_id and n.created_at > now() - interval '10 minutes') then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (other, 'message', 'Шинэ мессеж · ' || c.car,
            coalesce(nullif(split_part(coalesce(me.shop_name, me.full_name, ''), ' ', 1), ''), 'Хэрэглэгч') || ': ' || left(txt, 100), c.ad_id);
  end if;
  return mid;
end $$;
revoke execute on function public.chat_post(uuid, text) from public, anon, authenticated;

-- Худалдан авагч: зарын эзэнтэй чат эхлүүлэх (байгаа бол түүн рүү бичнэ). Чатын id буцаана.
create or replace function public.start_chat(p_ad uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; cid uuid;
begin
  if auth.uid() is null then raise exception 'Нэвтэрнэ үү'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if a.user_id = auth.uid() then raise exception 'Өөрийн зартай чатлах боломжгүй'; end if;
  select id into cid from public.conversations where ad_id = p_ad and buyer_id = auth.uid();
  if cid is null then
    if a.status <> 'active' or (a.expires_at is not null and a.expires_at <= now()) then raise exception 'Зар идэвхтэй биш байна'; end if;
    if (select count(*) from public.conversations c where c.buyer_id = auth.uid() and c.created_at > now() - interval '1 day') >= 30 then
      raise exception 'Өнөөдөр хэт олон шинэ чат эхлүүлсэн байна';
    end if;
    insert into public.conversations(ad_id, buyer_id, seller_id, car)
    values (a.id, auth.uid(), a.user_id, a.brand || ' ' || a.model || ' · ' || a.year_made)
    returning id into cid;
  end if;
  perform public.chat_post(cid, p_body);
  return cid;
end $$;

create or replace function public.send_message(p_conv uuid, p_body text) returns bigint
language sql security definer set search_path = public as $$
  select public.chat_post(p_conv, p_body)
$$;

-- Уншсан гэж тэмдэглэх
create or replace function public.mark_chat_read(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  update public.conversations set
    buyer_unread = case when buyer_id = auth.uid() then 0 else buyer_unread end,
    seller_unread = case when seller_id = auth.uid() then 0 else seller_unread end
  where id = p_conv and auth.uid() in (buyer_id, seller_id) returning * into c;
  if c.id is not null then
    update public.notifications set read = true
    where user_id = auth.uid() and type = 'message' and not read and ad_id is not distinct from c.ad_id;
  end if;
end $$;

-- Миний чатууд (нөгөө талын нэр, зарын зураг)
create or replace function public.my_chats() returns table(
  id uuid, ad_id uuid, car text, photo text, price bigint, ad_status text, role text, other_name text,
  last_message text, last_message_at timestamptz, last_from_me boolean, unread int
)
language sql stable security definer set search_path = public as $$
  select c.id, c.ad_id, c.car, a.photos[1], a.price, a.status,
         case when c.buyer_id = auth.uid() then 'buyer' else 'seller' end,
         case when c.buyer_id = auth.uid()
              then coalesce(case when s.role = 'dealer' then s.shop_name end, nullif(split_part(coalesce(s.full_name, ''), ' ', 1), ''), 'Худалдагч')
              else coalesce(nullif(split_part(coalesce(b.full_name, ''), ' ', 1), ''), 'Худалдан авагч') end,
         c.last_message, c.last_message_at, c.last_sender_id = auth.uid(),
         case when c.buyer_id = auth.uid() then c.buyer_unread else c.seller_unread end
  from public.conversations c
  left join public.ads a on a.id = c.ad_id
  join public.profiles s on s.id = c.seller_id
  join public.profiles b on b.id = c.buyer_id
  where auth.uid() in (c.buyer_id, c.seller_id)
  order by c.last_message_at desc
  limit 200
$$;

create or replace function public.chat_info(p_conv uuid) returns table(
  id uuid, ad_id uuid, car text, photo text, price bigint, ad_status text, role text, other_name text, other_id uuid
)
language sql stable security definer set search_path = public as $$
  select c.id, c.ad_id, c.car, a.photos[1], a.price, a.status,
         case when c.buyer_id = auth.uid() then 'buyer' when c.seller_id = auth.uid() then 'seller' else 'staff' end,
         case when c.buyer_id = auth.uid()
              then coalesce(case when s.role = 'dealer' then s.shop_name end, nullif(split_part(coalesce(s.full_name, ''), ' ', 1), ''), 'Худалдагч')
              when c.seller_id = auth.uid()
              then coalesce(nullif(split_part(coalesce(b.full_name, ''), ' ', 1), ''), 'Худалдан авагч')
              else coalesce(b.full_name, 'Худалдан авагч') || ' → ' || coalesce(s.shop_name, s.full_name, 'Худалдагч') end,
         case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  from public.conversations c
  left join public.ads a on a.id = c.ad_id
  join public.profiles s on s.id = c.seller_id
  join public.profiles b on b.id = c.buyer_id
  where c.id = p_conv and (auth.uid() in (c.buyer_id, c.seller_id) or public.is_staff())
$$;

create or replace function public.chat_unread() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when buyer_id = auth.uid() then buyer_unread else seller_unread end), 0)::int
  from public.conversations where auth.uid() in (buyer_id, seller_id)
$$;

-- Зарын эзэнд: хэдэн хүн утас харсан (нэргүй тоо)
create or replace function public.ad_interest(p_ad uuid) returns table(phone_views int, chats int)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.ad_phone_views v where v.ad_id = p_ad),
         (select count(*)::int from public.conversations c where c.ad_id = p_ad)
  where exists (select 1 from public.ads a where a.id = p_ad and (a.user_id = auth.uid() or public.is_staff()))
$$;

-- Шууд шинэчлэл: хоёр талын хувийн суваг руу дохио
create or replace function public.mz_chat_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations; payload jsonb;
begin
  if tg_table_name = 'messages' then
    select * into c from public.conversations where id = new.conversation_id;
  else
    c := new;
  end if;
  if c.id is null then return null; end if;
  payload := jsonb_build_object('table', 'messages', 'op', tg_op, 'id', c.id::text);
  begin
    perform realtime.send(payload, 'change', 'u:' || c.buyer_id, true);
    perform realtime.send(payload, 'change', 'u:' || c.seller_id, true);
  exception when others then null;
  end;
  return null;
end $$;
revoke execute on function public.mz_chat_broadcast() from public, anon, authenticated;
drop trigger if exists mz_chat_messages on public.messages;
create trigger mz_chat_messages after insert on public.messages
for each row execute function public.mz_chat_broadcast();
drop trigger if exists mz_chat_conversations on public.conversations;
create trigger mz_chat_conversations after update of buyer_unread, seller_unread on public.conversations
for each row execute function public.mz_chat_broadcast();

-- ---------- 4. Push холбоос ----------
create or replace function public.notify_url(p_type text, p_ad uuid) returns text
language sql immutable set search_path = public as $$
  select case
    when p_type = 'message' then '/messages'
    when p_type = 'sale_report' then '/admin/reports'
    when p_type = 'report_reviewed' then '/manager/reports'
    when p_type = 'loan_request' then '/leasing'
    when p_type = 'loan_update' then '/loans'
    when p_type = 'agent_commission' then '/agent'
    when p_type in ('ad_expiring','ad_expired','featured_on') then '/my'
    when p_type = 'ad_flag' then '/manager/flags'
    when p_type = 'featured_request' then '/admin/ads?featured=1'
    when p_ad is null then '/notifications'
    when p_type = 'staff_new_ad' then '/manager/ads?id=' || p_ad
    else '/ads/' || p_ad
  end
$$;

-- ---------- 5. Эрх ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.reveal_phone(uuid)', 'public.ad_interest(uuid)', 'public.start_chat(uuid, text)', 'public.send_message(uuid, text)',
    'public.mark_chat_read(uuid)', 'public.my_chats()', 'public.chat_info(uuid)', 'public.chat_unread()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.notify_url(text, uuid) to authenticated;

notify pgrst, 'reload schema';
