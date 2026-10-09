-- =====================================================================
-- ЗАСВАР 06: Зарын гэрээ (гарын үсэгтэй) + шимтгэл + менежерийн борлуулалтын тайлан
--   * Хэрэглэгч зар оруулахын өмнө гэрээ уншиж, гарын үсэг зурж зөвшөөрнө
--   * Шимтгэл: зар нийтлэгдсэнээс 2 хоногт 3%, 7 хоногт 2%, 10 хоногт 1.5%, түүнээс хойш 1.5%
--   * Менежер "энэ машиныг зарсан" тайлан илгээнэ → админ батлах/буцаах
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй.
-- =====================================================================

-- ---------- Тохиргоо ----------
alter table public.settings add column if not exists company_name text not null default 'Autoshop ХХК';
alter table public.settings add column if not exists commission_tiers jsonb not null
  default '[{"days":2,"percent":3},{"days":7,"percent":2},{"days":10,"percent":1.5}]'::jsonb;
alter table public.settings add column if not exists commission_after numeric(5,2) not null default 1.5;

create or replace function public.update_contract_settings(p_company text, p_tiers jsonb, p_after numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  if coalesce(trim(p_company), '') = '' then raise exception 'Компанийн нэр хоосон байна'; end if;
  if jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then raise exception 'Шимтгэлийн шат буруу'; end if;
  update public.settings set company_name = trim(p_company),
    commission_tiers = (select jsonb_agg(jsonb_build_object('days', (e->>'days')::int, 'percent', (e->>'percent')::numeric) order by (e->>'days')::int)
                        from jsonb_array_elements(p_tiers) e),
    commission_after = coalesce(p_after, 0), updated_at = now()
  where id = 1;
  perform public.log_action('Гэрээний нөхцөл өөрчиллөө');
end $$;

-- ---------- Гэрээ ----------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ad_id uuid references public.ads(id) on delete set null,
  company_name text not null,
  terms jsonb not null,               -- {"tiers":[...], "after":1.5}
  full_name text not null,
  phone text not null,
  brand text not null,
  model text not null,
  year_made int,
  plate_number text not null,
  vin text not null,
  price bigint not null,
  signature_svg text not null,        -- гарын үсэг: SVG path (600x200 талбайд)
  user_agent text,
  pdf_path text,                      -- storage: contracts/<user_id>/<id>.pdf
  signed_at timestamptz not null default now()
);
create index if not exists contracts_user_idx on public.contracts(user_id, signed_at desc);
create index if not exists contracts_ad_idx on public.contracts(ad_id);
alter table public.contracts enable row level security;
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select using (user_id = auth.uid() or public.is_staff());
grant select on public.contracts to authenticated;

alter table public.ads add column if not exists contract_id uuid references public.contracts(id) on delete set null;
create unique index if not exists ads_contract_uidx on public.ads(contract_id) where contract_id is not null;

-- Гэрээ байгуулах (гарын үсэгтэй). Зар оруулахын өмнө дуудна.
create or replace function public.sign_contract(
  p_full_name text, p_phone text, p_brand text, p_model text, p_year int,
  p_plate text, p_vin text, p_price bigint, p_signature text, p_ua text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.settings; pr public.profiles; cid uuid;
begin
  select * into pr from public.profiles where id = auth.uid();
  if pr.id is null then raise exception 'Нэвтрээгүй байна'; end if;
  if pr.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Овог нэрээ оруулна уу'; end if;
  if coalesce(length(p_signature), 0) < 20 then raise exception 'Гарын үсгээ зурна уу'; end if;
  if length(p_signature) > 60000 then raise exception 'Гарын үсэг хэт урт байна, дахин зурна уу'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Үнэ буруу байна'; end if;
  select * into s from public.settings where id = 1;
  insert into public.contracts(user_id, company_name, terms, full_name, phone, brand, model, year_made,
                               plate_number, vin, price, signature_svg, user_agent)
  values (auth.uid(), s.company_name, jsonb_build_object('tiers', s.commission_tiers, 'after', s.commission_after),
          trim(p_full_name), trim(p_phone), trim(p_brand), trim(p_model), p_year,
          upper(trim(p_plate)), upper(trim(p_vin)), p_price, p_signature, left(p_ua, 200))
  returning id into cid;
  return cid;
end $$;

create or replace function public.set_contract_pdf(p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.contracts set pdf_path = p_path
  where id = p_id and (user_id = auth.uid() or public.is_staff());
end $$;

-- Зар үүсэхэд гэрээг тухайн зартай холбоно
create or replace function public.ads_link_contract() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.contract_id is not null then
    update public.contracts set ad_id = new.id where id = new.contract_id;
  end if;
  return null;
end $$;
drop trigger if exists ads_link_contract on public.ads;
create trigger ads_link_contract after insert on public.ads
for each row execute function public.ads_link_contract();

-- Шинэ зар заавал гэрээтэй (өөрийн, ашиглагдаагүй гэрээ)
drop policy if exists ads_insert on public.ads;
create policy ads_insert on public.ads for insert with check (
  user_id = auth.uid()
  and status = 'pending'
  and manager_id is null and offer_amount is null and sold_at is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_blocked and p.profile_completed)
  and contract_id is not null
  and exists (select 1 from public.contracts c where c.id = contract_id and c.user_id = auth.uid() and c.ad_id is null)
);

-- ---------- Шимтгэл тооцох ----------
-- Зар нийтлэгдсэнээс (approved_at) зарагдах хүртэлх хугацаагаар
create or replace function public.commission_for(p_ad uuid, p_sold_at timestamptz default now())
returns table(days int, percent numeric)
language plpgsql stable security definer set search_path = public as $$
declare a public.ads; t jsonb; aft numeric; hrs numeric; e jsonb;
begin
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  select c.terms->'tiers', (c.terms->>'after')::numeric into t, aft from public.contracts c where c.id = a.contract_id;
  if t is null then
    select s.commission_tiers, s.commission_after into t, aft from public.settings s where s.id = 1;
  end if;
  hrs := greatest(0, extract(epoch from (p_sold_at - coalesce(a.approved_at, a.created_at))) / 3600);
  days := greatest(1, ceil(hrs / 24))::int;
  percent := coalesce(aft, 0);
  for e in select x from jsonb_array_elements(t) x order by (x->>'days')::int loop
    if hrs <= (e->>'days')::numeric * 24 then
      percent := (e->>'percent')::numeric;
      exit;
    end if;
  end loop;
  return next;
end $$;

-- ---------- Борлуулалтын тайлан ----------
create table if not exists public.sale_reports (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.ads(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  sold_price bigint not null check (sold_price > 0),
  sold_at timestamptz not null,
  buyer_name text,
  buyer_phone text,
  note text,
  days_on_market int not null,
  commission_percent numeric(5,2) not null,
  commission_amount bigint not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sale_reports_status_idx on public.sale_reports(status, created_at desc);
create unique index if not exists sale_reports_ad_open_uidx on public.sale_reports(ad_id) where status <> 'rejected';
alter table public.sale_reports enable row level security;
drop policy if exists sale_reports_read on public.sale_reports;
create policy sale_reports_read on public.sale_reports for select using (manager_id = auth.uid() or public.is_admin());
grant select on public.sale_reports to authenticated;

-- Менежер: "Энэ машиныг зарсан" тайлан илгээх
create or replace function public.submit_sale_report(
  p_ad uuid, p_price bigint, p_sold_at timestamptz default now(),
  p_buyer_name text default null, p_buyer_phone text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare a public.ads; c record; rid uuid; amt bigint; me public.profiles;
begin
  if not public.is_staff() then raise exception 'Эрх хүрэхгүй'; end if;
  select * into a from public.ads where id = p_ad;
  if a.id is null then raise exception 'Зар олдсонгүй'; end if;
  if a.status not in ('active','sold') then raise exception 'Зөвхөн нийтлэгдсэн зарыг зарагдсан гэж тайлагнана'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Зарагдсан үнэ оруулна уу'; end if;
  if exists (select 1 from public.sale_reports r where r.ad_id = p_ad and r.status <> 'rejected') then
    raise exception 'Энэ зарын тайлан аль хэдийн илгээгдсэн байна';
  end if;
  select * into c from public.commission_for(p_ad, coalesce(p_sold_at, now()));
  amt := round(p_price * c.percent / 100);
  insert into public.sale_reports(ad_id, manager_id, sold_price, sold_at, buyer_name, buyer_phone, note,
                                  days_on_market, commission_percent, commission_amount)
  values (p_ad, auth.uid(), p_price, coalesce(p_sold_at, now()), nullif(trim(p_buyer_name), ''),
          nullif(trim(p_buyer_phone), ''), nullif(trim(p_note), ''), c.days, c.percent, amt)
  returning id into rid;
  select * into me from public.profiles where id = auth.uid();
  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'sale_report', 'Шинэ тайлан: ' || a.brand || ' ' || a.model || ' зарагдлаа',
         coalesce(me.full_name, me.email, 'Менежер') || ' · ' || to_char(p_price, 'FM999,999,999,999') || '₮ · '
         || c.days || ' хоног · шимтгэл ' || c.percent || '% = ' || to_char(amt, 'FM999,999,999,999') || '₮',
         a.id
  from public.profiles p where p.role = 'admin' and not p.is_blocked and p.id <> auth.uid();
  perform public.log_action('Тайлан илгээв: ' || a.brand || ' ' || a.model || ' зарагдсан', a.id);
  return rid;
end $$;

-- Админ: тайлан батлах / буцаах. Батлахад зар "зарагдсан" болно.
create or replace function public.review_sale_report(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.sale_reports; a public.ads;
begin
  if not public.is_admin() then raise exception 'Эрх хүрэхгүй'; end if;
  update public.sale_reports set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'pending' returning * into r;
  if r.id is null then raise exception 'Тайлан олдсонгүй эсвэл аль хэдийн шийдвэрлэгдсэн'; end if;
  select * into a from public.ads where id = r.ad_id;
  if p_approve and a.status = 'active' then
    update public.ads set status = 'sold', sold_at = r.sold_at, sold_price = r.sold_price where id = a.id;
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (a.user_id, 'sold', 'Таны машин зарагдлаа', a.brand || ' ' || a.model || ' · ' || to_char(r.sold_price, 'FM999,999,999,999') || '₮', a.id);
  end if;
  if r.manager_id is not null then
    insert into public.notifications(user_id, type, title, body, ad_id)
    values (r.manager_id, 'report_reviewed',
            case when p_approve then 'Тайлан батлагдлаа' else 'Тайлан буцаагдлаа' end,
            a.brand || ' ' || a.model || coalesce(' · ' || nullif(trim(p_note), ''), ''), a.id);
  end if;
  perform public.log_action(case when p_approve then 'Тайлан баталлаа: ' else 'Тайлан буцаалаа: ' end || a.brand || ' ' || a.model, a.id);
end $$;

-- ---------- Эрх ----------
revoke execute on function public.update_contract_settings(text, jsonb, numeric) from public, anon;
revoke execute on function public.sign_contract(text, text, text, text, int, text, text, bigint, text, text) from public, anon;
revoke execute on function public.set_contract_pdf(uuid, text) from public, anon;
revoke execute on function public.commission_for(uuid, timestamptz) from public, anon;
revoke execute on function public.submit_sale_report(uuid, bigint, timestamptz, text, text, text) from public, anon;
revoke execute on function public.review_sale_report(uuid, boolean, text) from public, anon;
grant execute on function public.update_contract_settings(text, jsonb, numeric) to authenticated;
grant execute on function public.sign_contract(text, text, text, text, int, text, text, bigint, text, text) to authenticated;
grant execute on function public.set_contract_pdf(uuid, text) to authenticated;
grant execute on function public.commission_for(uuid, timestamptz) to authenticated;
grant execute on function public.submit_sale_report(uuid, bigint, timestamptz, text, text, text) to authenticated;
grant execute on function public.review_sale_report(uuid, boolean, text) to authenticated;

-- ---------- Гэрээний PDF хадгалах сан (хувийн) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "contracts read" on storage.objects;
create policy "contracts read" on storage.objects for select to authenticated
  using (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "contracts upload" on storage.objects;
create policy "contracts upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "contracts update" on storage.objects;
create policy "contracts update" on storage.objects for update to authenticated
  using (bucket_id = 'contracts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- Push мэдэгдлийн холбоос (тайлангийн шинэ төрлүүд) ----------
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
                    when r.type = 'sale_report' then '/admin/reports'
                    when r.type = 'report_reviewed' then '/manager/reports'
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

-- ---------- Шууд шинэчлэл ----------
drop trigger if exists mz_sync_reports on public.sale_reports;
create trigger mz_sync_reports after insert or update or delete on public.sale_reports
for each row execute function public.mz_broadcast();

notify pgrst, 'reload schema';
