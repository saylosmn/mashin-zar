-- Онцлох зарын төлбөр батлагдмагц шууд нийтлэгдэнэ. Telegram ботын хэсгийг устгав.

-- Telegram бот бүрэн хасагдсан: webhook-ийг салгаж, хүснэгт, функц, баганыг устгана
do $$
declare tok text;
begin
  if to_regclass('public.telegram_config') is not null then
    execute 'select bot_token from public.telegram_config where id = 1' into tok;
    if coalesce(tok, '') <> '' then
      begin
        perform net.http_post(url := 'https://api.telegram.org/bot' || tok || '/deleteWebhook',
          body := '{"drop_pending_updates": true}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb,
          timeout_milliseconds := 10000);
      exception when others then null;
      end;
    end if;
  end if;
end $$;
drop function if exists public.tg_webhook(text, jsonb);
drop function if exists public.tg_send_payment(uuid);
drop function if exists public.tg_refresh_payment(uuid);
drop function if exists public.tg_payment_text(uuid);
drop function if exists public.tg_notify(text);
drop function if exists public.tg_call(text, jsonb);
drop function if exists public.tg_esc(text);
drop function if exists public.telegram_admin();
drop function if exists public.save_telegram(text, text);
drop function if exists public.clear_telegram();
drop table if exists public.telegram_config;
alter table public.payments drop column if exists tg_request_id, drop column if exists tg_message_id;

-- ---------- Telegram-гүй хувилбарууд ----------

-- Хэрэглэгч: «Төлбөр төлсөн» -> админуудад мэдэгдэл
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
    raise exception 'Төлбөр баталгаажаагүй байна. «Админ → Төлбөрүүд»-ээс орлогыг батална уу.';
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

-- ---------- 4. Апп-аас ирсэн орлогыг боловсруулах (Next.js /api/sms энийг дамжуулна) ----------
create or replace function public.sms_ingest(p_key text, p_money text, p_value text, p_body text, p_sender text, p_date text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; amt bigint; h text; txt text; p public.payments; res text;
  fmt text := 'FM999,999,999,999';
begin
  select api_key into k from public.sms_config where id = 1;
  if coalesce(k, '') = '' or p_key is distinct from k then raise exception 'forbidden'; end if;
  update public.sms_config set last_seen_at = now() where id = 1;

  -- Апп-ын «Туршиж илгээх» товч
  if upper(trim(coalesce(p_value, ''))) = 'TEST' then return jsonb_build_object('code', 0, 'result', 'test'); end if;

  begin
    amt := floor(nullif(regexp_replace(coalesce(p_money, ''), '[^0-9.]', '', 'g'), '')::numeric)::bigint;
  exception when others then amt := null;
  end;
  -- Дүнгүй мессежийг алгасна (апп дахин илгээхгүй байхын тулд code 0)
  if amt is null or amt <= 0 then return jsonb_build_object('code', 0, 'result', 'skip'); end if;

  h := md5(coalesce(p_body, '') || '|' || coalesce(p_date, '') || '|' || amt);
  if exists (select 1 from public.sms_income where hash = h) then
    return jsonb_build_object('code', 0, 'result', 'duplicate');
  end if;

  -- Гүйлгээний утга + бүтэн текстээс MZXXXXXX кодыг хайна (зай, тэмдэгт, жижиг үсгийг үл тооно)
  txt := upper(regexp_replace(coalesce(p_value, '') || ' ' || coalesce(p_body, ''), '[^A-Za-z0-9]', '', 'g'));
  select * into p from public.payments
  where status in ('awaiting','submitted','rejected') and position(ref in txt) > 0
  order by created_at desc limit 1;

  if p.id is null then
    -- Аль хэдийн батлагдсан төлбөрийн код уу?
    select * into p from public.payments where status = 'confirmed' and position(ref in txt) > 0
    order by created_at desc limit 1;
    res := case when p.id is null then 'unmatched' else 'already' end;
  elsif amt < p.amount then
    res := 'short';
  else
    perform public._decide_payment(p.id, true, 'sms', null, 'SMS · банк');
    res := 'confirmed';
  end if;

  insert into public.sms_income(amount, value, body, sender, sms_date, hash, payment_id, result)
  values (amt, nullif(left(trim(coalesce(p_value, '')), 200), ''), left(p_body, 1000), left(p_sender, 40), left(p_date, 40), h, p.id, res);

  -- Код олдоогүй / дүн дутуу орлогыг админуудад мэдэгдэнэ (апп, push) - «Админ -> Төлбөрүүд»-ээс шийднэ
  if res in ('unmatched','short') then
    insert into public.notifications(user_id, type, title, body, ad_id)
    select pr.id, 'payment_submitted',
           case when res = 'short' then 'Орлого дутуу: ' || p.ref else 'Орлого орлоо — код олдсонгүй' end,
           to_char(amt, fmt) || '₮' || case when res = 'short' then ' (' || to_char(p.amount, fmt) || '₮ байх ёстой)' else '' end
           || ' · ' || left(coalesce(p_body, ''), 140), p.ad_id
    from public.profiles pr where pr.role = 'admin' and not pr.is_blocked;
  end if;

  return jsonb_build_object('code', 0, 'result', res, 'ref', p.ref);
end $$;

-- ---------- Онцлох зар төлбөр ормогц шууд нийтлэгдэнэ ----------

-- Төлбөр батлагдсан, шалгагдаж буй төлбөртэй зарыг нийтэлнэ (approve_ad-ийн менежергүй хувилбар)
create or replace function public._publish_paid_ad(p_ad uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.ads; s public.settings; pid uuid; fdays int := 0;
begin
  update public.ads set status = 'active', approved_at = now()
  where id = p_ad and status = 'pending' and plan = 'paid'
    and exists (select 1 from public.payments where ad_id = p_ad and status = 'confirmed')
  returning * into a;
  if a.id is null then return; end if;
  select * into s from public.settings where id = 1;

  for pid in select id from public.payments where ad_id = a.id and status = 'confirmed' and applied_at is null loop
    perform public._apply_payment(pid);
  end loop;
  select greatest(0, ceil(extract(epoch from (featured_until - now())) / 86400))::int into fdays from public.ads where id = a.id;

  insert into public.notifications(user_id, type, title, body, ad_id)
  values (a.user_id, 'payment_ok', 'Төлбөр баталгаажиж, зар нийтлэгдлээ ⭐',
          a.brand || ' ' || a.model || ' одоо бүх хэрэглэгчид харагдаж байна'
          || case when coalesce(fdays, 0) > 0 then ' · ' || fdays || ' хоног онцлох' else '' end, a.id);

  if s.notify_all_on_approve then
    insert into public.notifications(user_id, type, title, body, ad_id)
    select p.id, 'new_ad', 'Шинэ зар',
           a.brand || ' ' || a.model || ' · ' || a.year_made || ' · ' || to_char(a.price, 'FM999,999,999,999') || '₮', a.id
    from public.profiles p
    where p.id <> a.user_id and not p.is_blocked and p.notify_new_ads
      and (p.notify_category is null or p.notify_category = a.category)
      and (p.notify_brand is null or lower(p.notify_brand) = lower(a.brand))
      and (p.notify_max_price is null or a.price <= p.notify_max_price);
  end if;
  insert into public.activity_log(actor_id, action, ad_id)
  values (null, 'Төлбөр орсон онцлох зар автоматаар нийтлэгдэв: ' || a.brand || ' ' || a.model, a.id);
end $$;

-- Шийдвэр (вэб, SMS хоёулаа энийг дуудна). listing_plans_and_payments-ийнхтэй ижил, зөвхөн шалгагдаж буй
-- төлбөртэй зарыг менежерт илгээхийн оронд шууд нийтэлдэг болсон.
create or replace function public._decide_payment(p_id uuid, p_approve boolean, p_via text, p_actor uuid, p_actor_name text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare p public.payments; a public.ads; fmt text := 'FM999,999,999,999';
begin
  select * into p from public.payments where id = p_id for update;
  if p.id is null then return 'Төлбөр олдсонгүй'; end if;
  if p.status = 'confirmed' then return 'Аль хэдийн батлагдсан'; end if;
  if p.status = 'cancelled' then return 'Цуцлагдсан төлбөр'; end if;
  if not p_approve and p.status = 'rejected' then return 'Аль хэдийн «ороогүй» гэж тэмдэглэсэн'; end if;
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
    elsif a.id is not null and a.status = 'pending' and a.plan = 'paid' then
      -- Шууд нийтэлнэ (мэдэгдлийг _publish_paid_ad илгээнэ)
      perform public._publish_paid_ad(a.id);
    else
      insert into public.notifications(user_id, type, title, body, ad_id)
      values (p.user_id, 'payment_ok', 'Төлбөр баталгаажлаа',
              coalesce(a.brand || ' ' || a.model, p.ad_title, 'Зар') || ' · менежер шалгаж нийтэлмэгц ' || p.days || ' хоног онцлох болно', p.ad_id);
      if a.id is not null and a.status in ('pending','rejected') then
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
                   || case when p_via = 'sms' then ' (SMS)' else '' end, p.ad_id);
  return case when p_approve then '✅ Батлагдлаа' else '❌ Ороогүй гэж тэмдэглэлээ' end;
end $$;

revoke execute on function public._publish_paid_ad(uuid) from public, anon, authenticated;
revoke execute on function public._decide_payment(uuid, boolean, text, uuid, text, text) from public, anon, authenticated;

-- Өмнө нь төлбөр нь батлагдсан ч менежер хүлээж байсан төлбөртэй зарыг одоо нийтэлнэ
do $$
declare r record;
begin
  for r in select a.id from public.ads a
           where a.status = 'pending' and a.plan = 'paid'
             and exists (select 1 from public.payments p where p.ad_id = a.id and p.status = 'confirmed') loop
    perform public._publish_paid_ad(r.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
