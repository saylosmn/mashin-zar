-- Банкны орлогын SMS-ээр төлбөрийг автоматаар батлах (sms_ingest, X-Api-Key).

-- ---------- 1. Шийдвэрийн суваг: sms ----------
alter table public.payments drop constraint if exists payments_decided_via_check;
alter table public.payments add constraint payments_decided_via_check check (decided_via in ('web','telegram','sms')); -- telegram: хуучин бичлэг

-- ---------- 2. Апп-ын нууц түлхүүр (зөвхөн функцээр) ----------
create table if not exists public.sms_config (
  id int primary key default 1 check (id = 1),
  api_key text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  last_seen_at timestamptz,             -- апп хамгийн сүүлд холбогдсон (туршилт ч орно)
  updated_at timestamptz not null default now()
);
insert into public.sms_config (id) values (1) on conflict do nothing;
alter table public.sms_config enable row level security;
revoke all on public.sms_config from public, anon, authenticated;

-- ---------- 3. Ирсэн орлогын SMS ----------
create table if not exists public.sms_income (
  id uuid primary key default gen_random_uuid(),
  amount bigint not null,
  value text,                           -- гүйлгээний утга (апп-ын таньсан)
  body text,                            -- SMS-ийн бүтэн текст
  sender text,
  sms_date text,                        -- утсан дээрх хүлээн авсан цаг
  hash text not null unique,            -- нэг SMS-ийг давхар бүртгэхгүй
  payment_id uuid references public.payments(id) on delete set null,
  result text not null check (result in ('confirmed','already','short','unmatched')),
  created_at timestamptz not null default now()
);
create index if not exists sms_income_created_idx on public.sms_income(created_at desc);
alter table public.sms_income enable row level security;
drop policy if exists sms_income_read on public.sms_income;
create policy sms_income_read on public.sms_income for select using (public.is_admin());
revoke all on public.sms_income from anon;
grant select on public.sms_income to authenticated;

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

-- ---------- 5. Админ: түлхүүр харах, солих ----------
create or replace function public.sms_admin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.sms_config;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into c from public.sms_config where id = 1;
  return jsonb_build_object('api_key', c.api_key, 'last_seen_at', c.last_seen_at);
end $$;

create or replace function public.regen_sms_key() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.sms_config set api_key = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    last_seen_at = null, updated_at = now() where id = 1;
  perform public.log_action('SMS апп-ын түлхүүр солив');
end $$;

-- ---------- 6. Эрх (GRANT) ----------
revoke execute on function public.sms_admin() from public, anon;
grant execute on function public.sms_admin() to authenticated;
revoke execute on function public.regen_sms_key() from public, anon;
grant execute on function public.regen_sms_key() to authenticated;
-- Апп-аас (нэвтрээгүй) ирэх хүсэлт - нууц түлхүүрээр шалгана
revoke execute on function public.sms_ingest(text, text, text, text, text, text) from public;
grant execute on function public.sms_ingest(text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
