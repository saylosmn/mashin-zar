-- Зар оруулах 2 сонголт (шимтгэлтэй / онцлох төлбөртэй), төлбөрийн бүртгэл.

-- ---------- 0. Тохиргоо ----------
alter table public.settings add column if not exists commission_featured_days int not null default 7; -- шимтгэлтэй зарыг үнэгүй онцлох хоног (0 = үгүй)
alter table public.settings add column if not exists pay_bank text;      -- банкны нэр
alter table public.settings add column if not exists pay_account text;   -- дансны дугаар (IBAN)
alter table public.settings add column if not exists pay_holder text;    -- данс эзэмшигч
do $$
begin
  alter table public.settings add constraint settings_commission_featured check (commission_featured_days between 0 and 365);
exception when duplicate_object then null;
end $$;

-- ---------- 1. Зарын сонголт ----------
alter table public.ads add column if not exists plan text not null default 'commission';
do $$
begin
  alter table public.ads add constraint ads_plan_check check (plan in ('commission','paid'));
exception when duplicate_object then null;
end $$;

-- Шимтгэлтэй зар гэрээтэй, төлбөртэй зар гэрээгүй
drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert with check (
  user_id = auth.uid()
  and (status = 'pending' or (status = 'active' and public.my_role() = 'dealer'))
  and manager_id is null and offer_amount is null and sold_at is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_blocked and p.profile_completed)
  and (
    public.my_role() = 'dealer'
    or (ads.plan = 'paid' and ads.contract_id is null)
    or (ads.plan = 'commission' and ads.contract_id is not null
        and exists (select 1 from public.contracts c
                    where c.id = ads.contract_id and c.user_id = auth.uid() and c.ad_id is null and c.consumed_at is null
                      and regexp_replace(upper(c.plate_number), '\s', '', 'g') = regexp_replace(upper(ads.plate_number), '\s', '', 'g')
                      and regexp_replace(upper(c.vin), '\s', '', 'g') = regexp_replace(upper(ads.vin), '\s', '', 'g')))
  )
);

-- ---------- 2. Төлбөр ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid references public.ads(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ad_title text,                       -- зар устсан ч юуны төлбөр болохыг харуулна
  amount bigint not null check (amount >= 0),
  days int not null check (days between 1 and 365),
  ref text not null unique,            -- гүйлгээний утга (MZXXXXXX)
  status text not null default 'awaiting' check (status in ('awaiting','submitted','confirmed','rejected','cancelled')),
  payer_note text,                     -- хэрэглэгчийн тэмдэглэл (шилжүүлсэн нэр, данс)
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_via text check (decided_via in ('web','telegram')),
  decided_name text,
  admin_note text,
  applied_at timestamptz,              -- онцлох хугацаа зарт нэмэгдсэн
  tg_request_id bigint,
  tg_message_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists payments_ad_idx on public.payments(ad_id, created_at desc);
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);
create index if not exists payments_status_idx on public.payments(status, submitted_at desc);
alter table public.payments enable row level security;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (user_id = auth.uid() or public.is_staff());
revoke all on public.payments from anon;
grant select on public.payments to authenticated;

drop trigger if exists mz_sync_payments on public.payments;
create trigger mz_sync_payments after insert or update or delete on public.payments
for each row execute function public.mz_broadcast();

create or replace function public.new_pay_ref() returns text
language plpgsql volatile set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'MZ';
    for i in 1..6 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.payments where ref = c);
  end loop;
  return c;
end $$;

-- ---------- 3. Telegram тохиргоо (нууц: зөвхөн функцээр) ----------
create table if not exists public.telegram_config (
  id int primary key default 1 check (id = 1),
  bot_token text,
  chat_id text,
  webhook_secret text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  updated_at timestamptz not null default now()
);
insert into public.telegram_config (id) values (1) on conflict do nothing;
alter table public.telegram_config enable row level security;
revoke all on public.telegram_config from public, anon, authenticated;

create or replace function public.tg_esc(t text) returns text
language sql immutable as $$ select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') $$;

-- Telegram Bot API дуудах (pg_net, асинхрон). Токен тохируулаагүй бол юу ч хийхгүй.
create or replace function public.tg_call(p_method text, p_body jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare c public.telegram_config; rid bigint;
begin
  select * into c from public.telegram_config where id = 1;
  if coalesce(c.bot_token, '') = '' then return null; end if;
  begin
    select net.http_post(url := 'https://api.telegram.org/bot' || c.bot_token || '/' || p_method, body := p_body,
      headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 10000) into rid;
  exception when others then rid := null;
  end;
  return rid;
end $$;

create or replace function public.tg_payment_text(p_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare p public.payments; a public.ads; u public.profiles; t text; nl text := E'\n';
  site text := coalesce((select site_url from public.settings where id = 1), 'https://web-mu-fawn-45.vercel.app');
  fmt text := 'FM999,999,999,999';
begin
  select * into p from public.payments where id = p_id;
  if p.id is null then return null; end if;
  select * into a from public.ads where id = p.ad_id;
  select * into u from public.profiles where id = p.user_id;
  t := '💳 <b>Онцлох зарын төлбөр</b>' || nl
    || '<b>' || public.tg_esc(coalesce(a.brand || ' ' || a.model || ' · ' || a.year_made, p.ad_title, 'Зар устгагдсан')) || '</b>'
    || coalesce(' · ' || to_char(a.price, fmt) || '₮', '') || nl
    || 'Дүн: <b>' || to_char(p.amount, fmt) || '₮</b> · ⭐ ' || p.days || ' хоног' || nl
    || 'Гүйлгээний утга: <code>' || p.ref || '</code>' || nl
    || 'Хэрэглэгч: ' || public.tg_esc(coalesce(u.full_name, u.email, '—')) || coalesce(' · ' || public.tg_esc(u.phone), '') || nl
    || coalesce('Тэмдэглэл: ' || public.tg_esc(p.payer_note) || nl, '')
    || 'Зар: ' || case a.status when 'pending' then 'шалгагдаж буй' when 'active' then 'нийтлэгдсэн' when 'hidden' then 'нуусан'
                                when 'rejected' then 'татгалзсан' when 'sold' then 'зарагдсан' else 'устгагдсан' end
    || case when a.plan = 'paid' then ' · шимтгэлгүй сонголт' else '' end || nl
    || '<a href="' || site || '/admin/payments">Админ → Төлбөрүүд</a>';
  if p.status = 'confirmed' then
    t := t || nl || nl || '✅ <b>Орлого орсон</b> — ' || public.tg_esc(coalesce(p.decided_name, ''))
      || ' · ' || to_char(p.decided_at at time zone 'Asia/Ulaanbaatar', 'MM-DD HH24:MI');
  elsif p.status = 'rejected' then
    t := t || nl || nl || '❌ <b>Ороогүй</b> — ' || public.tg_esc(coalesce(p.decided_name, ''))
      || ' · ' || to_char(p.decided_at at time zone 'Asia/Ulaanbaatar', 'MM-DD HH24:MI');
  elsif p.status = 'cancelled' then
    t := t || nl || nl || '🚫 Цуцлагдсан';
  end if;
  return t;
end $$;

-- Шинэ мессеж (товчтой) илгээнэ
create or replace function public.tg_send_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.telegram_config; rid bigint;
begin
  select * into c from public.telegram_config where id = 1;
  if coalesce(c.bot_token, '') = '' or coalesce(c.chat_id, '') = '' then return; end if;
  rid := public.tg_call('sendMessage', jsonb_build_object(
    'chat_id', c.chat_id, 'text', public.tg_payment_text(p_id), 'parse_mode', 'HTML', 'disable_web_page_preview', true,
    'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text', '✅ Орлого орсон', 'callback_data', 'pay:' || p_id || ':ok'),
      jsonb_build_object('text', '❌ Ороогүй', 'callback_data', 'pay:' || p_id || ':no'))))));
  update public.payments set tg_request_id = rid, tg_message_id = null where id = p_id;
end $$;

-- Шийдвэрлэсний дараа мессежийг шинэчилж товчийг арилгана
create or replace function public.tg_refresh_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.telegram_config; p public.payments; mid bigint;
begin
  select * into c from public.telegram_config where id = 1;
  select * into p from public.payments where id = p_id;
  if p.id is null or coalesce(c.chat_id, '') = '' then return; end if;
  mid := p.tg_message_id;
  if mid is null and p.tg_request_id is not null then
    begin
      execute 'select ((content::jsonb)->''result''->>''message_id'')::bigint from net._http_response where id = $1'
        into mid using p.tg_request_id;
    exception when others then mid := null;
    end;
  end if;
  if mid is null then return; end if;
  if p.tg_message_id is null then update public.payments set tg_message_id = mid where id = p_id; end if;
  perform public.tg_call('editMessageText', jsonb_build_object(
    'chat_id', c.chat_id, 'message_id', mid, 'text', public.tg_payment_text(p_id), 'parse_mode', 'HTML', 'disable_web_page_preview', true));
end $$;

-- ---------- 4. Төлбөр үүсгэх, илгээх, батлах ----------
-- Зарын нээлттэй төлбөр (хүлээгдэж/шалгагдаж/ороогүй) байвал тэрийг, үгүй бол шинээр
create or replace function public._open_payment(p_ad uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; s public.settings; pid uuid;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then return null; end if;
  select id into pid from public.payments
  where ad_id = p_ad and status in ('awaiting','submitted','rejected') order by created_at desc limit 1;
  if pid is not null then return pid; end if;
  select * into s from public.settings where id = 1;
  insert into public.payments(ad_id, user_id, ad_title, amount, days, ref)
  values (a.id, a.user_id, a.brand || ' ' || a.model || ' · ' || a.year_made, coalesce(s.featured_price, 50000),
          coalesce(s.featured_days, 7), public.new_pay_ref())
  returning id into pid;
  return pid;
end $$;

-- Батлагдсан төлбөрийн онцлох хугацааг зарт нэмнэ (зар нийтлэгдсэн үед)
create or replace function public._apply_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments;
begin
  update public.payments set applied_at = now() where id = p_id and status = 'confirmed' and applied_at is null returning * into p;
  if p.id is null then return; end if;
  update public.ads set featured_until = greatest(now(), coalesce(featured_until, now())) + make_interval(days => p.days),
    featured_requested_at = null where id = p.ad_id;
end $$;

-- Төлбөртэй (paid) зар үүсэхэд төлбөр автоматаар үүснэ
create or replace function public.ads_plan_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan = 'paid' and new.status = 'pending' then perform public._open_payment(new.id); end if;
  return null;
end $$;
drop trigger if exists ads_plan_payment on public.ads;
create trigger ads_plan_payment after insert on public.ads
for each row execute function public.ads_plan_payment();

-- Зар устгахад төлөөгүй төлбөр цуцлагдана
create or replace function public.ads_cancel_payments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.payments set status = 'cancelled' where ad_id = old.id and status in ('awaiting','rejected');
  return old;
end $$;
drop trigger if exists ads_cancel_payments on public.ads;
create trigger ads_cancel_payments before delete on public.ads
for each row execute function public.ads_cancel_payments();

-- Хэрэглэгч: зараа онцлох болгох төлбөр нээх (нийтлэгдсэн зар, эсвэл төлбөртэй сонголттой шалгагдаж буй зар)
create or replace function public.open_payment(p_ad uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null or a.user_id is distinct from auth.uid() then raise exception 'Зар олдсонгүй'; end if;
  if public.my_role() is null then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if not ((a.status = 'active' and (a.expires_at is null or a.expires_at > now()))
          or (a.plan = 'paid' and a.status in ('pending','rejected'))) then
    raise exception 'Зөвхөн нийтлэгдсэн зарыг онцлох болгоно';
  end if;
  return public._open_payment(p_ad);
end $$;

-- Хэрэглэгч: «Төлбөр төлсөн» -> админуудад мэдэгдэл + Telegram
create or replace function public.submit_payment(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments; a public.ads;
begin
  select * into p from public.payments where id = p_id for update;
  if p.id is null or p.user_id is distinct from auth.uid() then raise exception 'Төлбөр олдсонгүй'; end if;
  if public.my_role() is null then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if p.status = 'submitted' then raise exception 'Илгээгдсэн байна. Шалгаад удахгүй баталгаажуулна.'; end if;
  if p.status = 'confirmed' then raise exception 'Төлбөр аль хэдийн баталгаажсан'; end if;
  if p.status = 'cancelled' or p.ad_id is null then raise exception 'Төлбөр цуцлагдсан байна'; end if;
  if p.decided_at > now() - interval '2 minutes' then raise exception 'Түр хүлээгээд дахин оролдоно уу'; end if;
  update public.payments set status = 'submitted', submitted_at = now(), payer_note = nullif(left(trim(p_note), 300), ''),
    decided_at = null, decided_by = null, decided_via = null, decided_name = null, admin_note = null
  where id = p_id returning * into p;
  select * into a from public.ads where id = p.ad_id;
  insert into public.notifications(user_id, type, title, body, ad_id)
  select pr.id, 'payment_submitted', 'Төлбөр шалгах: ' || p.ref,
         coalesce(a.brand || ' ' || a.model, p.ad_title, 'Зар') || ' · ' || to_char(p.amount, 'FM999,999,999,999') || '₮', p.ad_id
  from public.profiles pr where pr.role = 'admin' and not pr.is_blocked;
  perform public.tg_send_payment(p.id);
end $$;

-- Шийдвэр (вэб ба Telegram хоёулаа энийг дуудна). Буцаах утга нь үр дүнгийн богино текст.
create or replace function public._decide_payment(p_id uuid, p_approve boolean, p_via text, p_actor uuid, p_actor_name text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare p public.payments; a public.ads; fmt text := 'FM999,999,999,999';
begin
  select * into p from public.payments where id = p_id for update;
  if p.id is null then return 'Төлбөр олдсонгүй'; end if;
  if p.status = 'confirmed' then perform public.tg_refresh_payment(p.id); return 'Аль хэдийн батлагдсан'; end if;
  if p.status = 'cancelled' then perform public.tg_refresh_payment(p.id); return 'Цуцлагдсан төлбөр'; end if;
  if not p_approve and p.status = 'rejected' then perform public.tg_refresh_payment(p.id); return 'Аль хэдийн «ороогүй» гэж тэмдэглэсэн'; end if;
  select * into a from public.ads where id = p.ad_id;

  update public.payments set status = case when p_approve then 'confirmed' else 'rejected' end,
    decided_at = now(), decided_by = p_actor, decided_via = p_via, decided_name = left(p_actor_name, 80),
    admin_note = nullif(left(trim(p_note), 300), '')
  where id = p.id returning * into p;

  if p_approve then
    if a.id is not null and a.status in ('active','hidden') then
      perform public._apply_payment(p.id);
      insert into public.notifications(user_id, type, title, body, ad_id)
      values (p.user_id, 'payment_ok', 'Төлбөр баталгаажлаа ⭐',
              a.brand || ' ' || a.model || ' · ' || p.days || ' хоног жагсаалтын эхэнд онцлох боллоо', a.id);
    else
      insert into public.notifications(user_id, type, title, body, ad_id)
      values (p.user_id, 'payment_ok', 'Төлбөр баталгаажлаа',
              coalesce(a.brand || ' ' || a.model, p.ad_title, 'Зар') || ' · менежер шалгаж нийтэлмэгц ' || p.days || ' хоног онцлох болно', p.ad_id);
      if a.id is not null and a.status = 'pending' then
        insert into public.notifications(user_id, type, title, body, ad_id)
        select pr.id, 'staff_new_ad', 'Төлбөр орсон зар батлахад бэлэн',
               a.brand || ' ' || a.model || ' · ' || a.year_made || ' · ' || to_char(a.price, fmt) || '₮', a.id
        from public.profiles pr where pr.role in ('manager','admin') and not pr.is_blocked;
      end if;
    end if;
  else
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (p.user_id, 'payment_rejected', 'Төлбөр орж ирээгүй байна',
            'Гүйлгээний утга ' || p.ref || ' · ' || to_char(p.amount, fmt) || '₮. Шалгаад «Төлбөр төлсөн» товчийг дахин дарна уу.'
            || coalesce(' ' || nullif(trim(p_note), ''), ''), p.ad_id);
  end if;
  insert into public.activity_log(actor_id, action, ad_id)
  values (p_actor, case when p_approve then 'Төлбөр баталлаа: ' else 'Төлбөр ороогүй: ' end || p.ref
                   || case when p_via = 'telegram' then ' (Telegram · ' || coalesce(p_actor_name, '') || ')' else '' end, p.ad_id);
  perform public.tg_refresh_payment(p.id);
  return case when p_approve then '✅ Батлагдлаа' else '❌ Ороогүй гэж тэмдэглэлээ' end;
end $$;

-- Админ (вэб): батлах / ороогүй
create or replace function public.decide_payment(p_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into me from public.profiles where id = auth.uid();
  return public._decide_payment(p_id, p_approve, 'web', auth.uid(), coalesce(me.full_name, me.email, 'Админ'), p_note);
end $$;

-- ---------- 5. Telegram webhook (Next.js /api/telegram энийг дамжуулна) ----------
create or replace function public.tg_webhook(p_secret text, p_update jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare c public.telegram_config; cq jsonb; m text[]; chat text; res text; txt text; who text; r record; n int := 0;
begin
  select * into c from public.telegram_config where id = 1;
  if coalesce(c.webhook_secret, '') = '' or p_secret is distinct from c.webhook_secret then raise exception 'forbidden'; end if;

  cq := p_update->'callback_query';
  if cq is not null then
    chat := cq->'message'->'chat'->>'id';
    who := 'Telegram · ' || coalesce(nullif(trim(coalesce(cq->'from'->>'first_name', '') || ' ' || coalesce(cq->'from'->>'last_name', '')), ''), '')
           || coalesce(' @' || (cq->'from'->>'username'), '');
    m := regexp_match(coalesce(cq->>'data', ''), '^pay:([0-9a-f-]{36}):(ok|no)$');
    if chat is distinct from c.chat_id then
      res := 'Энэ чат холбогдоогүй';
    elsif m is null then
      res := 'Буруу товч';
    else
      update public.payments set tg_message_id = (cq->'message'->>'message_id')::bigint where id = m[1]::uuid;
      res := public._decide_payment(m[1]::uuid, m[2] = 'ok', 'telegram', null, who);
    end if;
    perform public.tg_call('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', res));
    return res;
  end if;

  chat := p_update->'message'->'chat'->>'id';
  txt := coalesce(p_update->'message'->>'text', '');
  if chat is null then return 'skip'; end if;
  if txt ~* '^/(start|id)' then
    perform public.tg_call('sendMessage', jsonb_build_object('chat_id', chat, 'parse_mode', 'HTML',
      'text', 'Энэ чатын ID: <code>' || chat || '</code>' || E'\n'
              || case when chat = c.chat_id then '✅ Машин зарын төлбөрийн мэдэгдэл энд ирнэ. /list — шалгах төлбөрүүд'
                      else 'Энэ ID-г вэбийн «Админ → Тохиргоо → Telegram» хэсэгт оруулна уу.' end));
    return 'id';
  end if;
  if txt ~* '^/list' and chat = c.chat_id then
    for r in select id from public.payments where status = 'submitted' order by submitted_at limit 10 loop
      perform public.tg_send_payment(r.id); n := n + 1;
    end loop;
    if n = 0 then
      perform public.tg_call('sendMessage', jsonb_build_object('chat_id', chat, 'text', 'Шалгах төлбөр алга ✅'));
    end if;
    return 'list';
  end if;
  return 'skip';
end $$;

-- ---------- 6. Админ: Telegram ба дансны тохиргоо ----------
create or replace function public.telegram_admin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.telegram_config;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into c from public.telegram_config where id = 1;
  return jsonb_build_object('bot_token', c.bot_token, 'chat_id', c.chat_id, 'webhook_secret', c.webhook_secret);
end $$;

-- p_token хоосон бол хуучин токен хэвээр (зөвхөн chat ID солих)
create or replace function public.save_telegram(p_token text, p_chat text) returns void
language plpgsql security definer set search_path = public as $$
declare tok text := nullif(trim(coalesce(p_token, '')), ''); ch text := nullif(trim(coalesce(p_chat, '')), '');
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if tok is not null and tok !~ '^\d{5,15}:[A-Za-z0-9_-]{30,60}$' then raise exception 'Бот токен буруу байна (BotFather-аас авсан 123456:ABC... хэлбэртэй)'; end if;
  if ch is null or ch !~ '^-?\d{3,20}$' then raise exception 'Chat ID буруу байна (зөвхөн тоо, бүлэг бол - тэмдэгтэй)'; end if;
  if tok is null and coalesce((select bot_token from public.telegram_config where id = 1), '') = '' then raise exception 'Бот токеноо оруулна уу'; end if;
  update public.telegram_config set bot_token = coalesce(tok, bot_token), chat_id = ch, updated_at = now() where id = 1;
  perform public.log_action('Telegram бот тохируулав');
end $$;

create or replace function public.clear_telegram() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.telegram_config set bot_token = null, chat_id = null,
    webhook_secret = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), updated_at = now() where id = 1;
  perform public.log_action('Telegram бот салгав');
end $$;

create or replace function public.update_payment_settings(p_bank text, p_account text, p_holder text, p_commission_featured_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if p_commission_featured_days is null or p_commission_featured_days not between 0 and 365 then raise exception 'Онцлох хоног 0–365 байна'; end if;
  update public.settings set pay_bank = nullif(left(trim(p_bank), 80), ''), pay_account = nullif(left(trim(p_account), 60), ''),
    pay_holder = nullif(left(trim(p_holder), 120), ''), commission_featured_days = p_commission_featured_days, updated_at = now()
  where id = 1;
  perform public.log_action('Тохиргоо: төлбөрийн данс, сонголт');
end $$;

-- ---------- 7. Зар батлах: төлбөртэй зар төлбөр баталгаажсны дараа, онцлох хугацаа эхэлнэ ----------
create or replace function public.approve_ad(p_ad uuid) returns int
language plpgsql security definer set search_path = public as $$
declare a public.ads; s public.settings; n int := 0; fdays int := 0; pid uuid;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is not null and a.plan = 'paid' and a.status in ('pending','rejected')
     and not exists (select 1 from public.payments where ad_id = p_ad and status = 'confirmed') then
    raise exception 'Төлбөр баталгаажаагүй байна. «Админ → Төлбөрүүд» эсвэл Telegram-аас орлогыг батална уу.';
  end if;
  update public.ads set status = 'active', approved_at = now(), manager_id = auth.uid()
  where id = p_ad and status in ('pending','rejected') returning * into a;
  if a.id is null then raise exception 'Зар олдсонгүй эсвэл аль хэдийн батлагдсан'; end if;
  select * into s from public.settings where id = 1;

  -- Онцлох: төлбөртэй бол төлсөн хоног, шимтгэлтэй бол тохиргооны хоног (үнэгүй)
  if a.plan = 'paid' then
    for pid in select id from public.payments where ad_id = a.id and status = 'confirmed' and applied_at is null loop
      perform public._apply_payment(pid);
    end loop;
  elsif coalesce(s.commission_featured_days, 0) > 0 and (a.featured_until is null or a.featured_until < now()) then
    update public.ads set featured_until = now() + make_interval(days => s.commission_featured_days) where id = a.id;
  end if;
  select greatest(0, ceil(extract(epoch from (featured_until - now())) / 86400))::int into fdays from public.ads where id = a.id;

  insert into public.notifications(user_id, type, title, body, ad_id)
  values (a.user_id, 'ad_approved', 'Таны зар батлагдлаа',
          a.brand || ' ' || a.model || ' одоо бүх хэрэглэгчид харагдаж байна'
          || case when coalesce(fdays, 0) > 0 then ' · ⭐ ' || fdays || ' хоног онцлох' else '' end, a.id);

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

-- ---------- 8. Шимтгэл: төлбөртэй (шимтгэлгүй) сонголтод 0% ----------
create or replace function public.commission_for(p_ad uuid, p_sold_at timestamptz default now())
returns table(days int, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare a public.ads; t jsonb; aft numeric; hrs numeric; e jsonb;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if not (public.is_staff() or a.user_id = auth.uid()) then raise exception 'Эрх хүрэхгүй'; end if;
  hrs := greatest(0, extract(epoch from (p_sold_at - coalesce(a.approved_at, a.created_at))) / 3600);
  days := greatest(1, ceil(hrs / 24))::int;
  if a.plan = 'paid' then
    percent := 0;
    return next;
    return;
  end if;
  select c.terms->'tiers', (c.terms->>'after')::numeric into t, aft from public.contracts c where c.id = a.contract_id;
  if t is null then
    select s.commission_tiers, s.commission_after into t, aft from public.settings s where s.id = 1;
  end if;
  percent := coalesce(aft, 0);
  for e in select x from jsonb_array_elements(t) x order by (x->>'days')::int loop
    if hrs <= (e->>'days')::numeric * 24 then
      percent := (e->>'percent')::numeric;
      exit;
    end if;
  end loop;
  return next;
end $$;

-- ---------- 9. Realtime: төлбөрийн өөрчлөлт эзэнд ----------
create or replace function public.mz_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb; o jsonb; payload jsonb; st text; ost text; uid text; pid text;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    -- Зөвхөн үзэлтийн тоо (эсвэл Telegram-ын дотоод талбар) өөрчлөгдсөн бол дохио илгээхгүй
    if (rec - 'views' - 'updated_at' - 'tg_request_id' - 'tg_message_id') = (o - 'views' - 'updated_at' - 'tg_request_id' - 'tg_message_id') then return null; end if;
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
             when 'payments' then rec->>'user_id'
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

-- ---------- 10. Push холбоос ----------
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
    when p_type = 'payment_submitted' then '/admin/payments'
    when p_type in ('payment_ok','payment_rejected') then coalesce('/pay/' || p_ad, '/my')
    when p_ad is null then '/notifications'
    when p_type = 'staff_new_ad' then '/manager/ads?id=' || p_ad
    else '/ads/' || p_ad
  end
$$;

-- ---------- 11. Эрх (GRANT) ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.new_pay_ref()', 'public.tg_call(text, jsonb)', 'public.tg_payment_text(uuid)', 'public.tg_send_payment(uuid)',
    'public.tg_refresh_payment(uuid)', 'public._open_payment(uuid)', 'public._apply_payment(uuid)',
    'public.ads_plan_payment()', 'public.ads_cancel_payments()',
    'public._decide_payment(uuid, boolean, text, uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.open_payment(uuid)', 'public.submit_payment(uuid, text)', 'public.decide_payment(uuid, boolean, text)',
    'public.telegram_admin()', 'public.save_telegram(text, text)', 'public.clear_telegram()',
    'public.update_payment_settings(text, text, text, int)', 'public.approve_ad(uuid)', 'public.commission_for(uuid, timestamptz)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- Webhook: нэвтрээгүй (Telegram-аас ирсэн) хүсэлт - нууц түлхүүрээр шалгана
revoke execute on function public.tg_webhook(text, jsonb) from public;
grant execute on function public.tg_webhook(text, jsonb) to anon, authenticated;
grant execute on function public.tg_esc(text) to anon, authenticated;
