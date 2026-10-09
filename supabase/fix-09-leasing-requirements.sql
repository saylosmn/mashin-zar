-- =====================================================================
-- ЗАСВАР 09: Лизингийн шаардлага, анкет, баримт бичиг
--   * Лизингийн компани бүр шаардлагаа тохируулна (нас, ажилласан хугацаа,
--     өр/орлогын харьцаа, машины он, хамтран зээлдэгч, заавал бүрдүүлэх баримт)
--   * Хүсэлт бүрт бүрэн анкет (регистр, хаяг, ажил, орлого, зээл, холбоо барих хүн,
--     хамтран зээлдэгч) + баримтын зураг/PDF (хувийн "loan-docs" сан)
--   * Систем хүсэлт бүрийг шаардлагатай тулгаж ✓/✗ (checks) хадгална
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй. fix-08-ийн дараа.
-- =====================================================================

-- ---------- Түншийн шаардлага ----------
alter table public.leasing_partners add column if not exists min_age int not null default 18;
alter table public.leasing_partners add column if not exists max_age int not null default 65;
alter table public.leasing_partners add column if not exists min_work_months int not null default 6;
alter table public.leasing_partners add column if not exists min_business_months int not null default 12;
alter table public.leasing_partners add column if not exists max_dti numeric(5,2) not null default 50;
alter table public.leasing_partners add column if not exists min_car_year int;
alter table public.leasing_partners add column if not exists cosigner_over bigint;
alter table public.leasing_partners add column if not exists required_docs text[] not null default array['id_front','id_back','ndsh','bank_statement'];
alter table public.leasing_partners add column if not exists requirements_note text;

-- ---------- Хүсэлтийн анкет ----------
alter table public.loan_requests add column if not exists applicant jsonb not null default '{}'::jsonb;
alter table public.loan_requests add column if not exists docs jsonb not null default '{}'::jsonb;
alter table public.loan_requests add column if not exists checks jsonb not null default '[]'::jsonb;
alter table public.loan_requests add column if not exists checks_ok boolean;
alter table public.loan_requests add column if not exists dti numeric(6,2);

-- Баримтын төрлүүд (вэб/апп-ын LOAN_DOCS-тэй ижил)
create or replace function public.loan_doc_kinds() returns text[]
language sql immutable as $$
  select array['id_front','id_back','ndsh','bank_statement','address','employment','business','license','photo','credit','cosigner_id']
$$;

-- Регистрийн дугаараас төрсөн огноо (АА00000000; 2000 оноос хойш төрсөн бол сар +20). Буруу бол null.
create or replace function public.rd_birth_date(p_rd text) returns date
language plpgsql immutable as $$
declare r text := upper(regexp_replace(coalesce(p_rd, ''), '\s', '', 'g')); y int; m int; d int;
begin
  if r !~ '^[А-ЯЁӨҮ]{2}[0-9]{8}$' then return null; end if;
  y := substr(r, 3, 2)::int; m := substr(r, 5, 2)::int; d := substr(r, 7, 2)::int;
  if m > 20 then y := 2000 + y; m := m - 20; else y := 1900 + y; end if;
  return make_date(y, m, d);
exception when others then return null;
end $$;

-- ---------- Баримтын хувийн сан ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loan-docs', 'loan-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "loan docs upload" on storage.objects;
create policy "loan docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'loan-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "loan docs delete" on storage.objects;
create policy "loan docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'loan-docs' and (storage.foldername(name))[1] = auth.uid()::text);
-- Унших: өөрөө, админ, эсвэл тухайн хүсэлтийг хүлээн авсан лизингийн компанийн ажилтан
drop policy if exists "loan docs read" on storage.objects;
create policy "loan docs read" on storage.objects for select to authenticated
  using (bucket_id = 'loan-docs' and (
    (storage.foldername(objects.name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.loan_requests r, jsonb_each_text(r.docs) d
               where r.partner_id = public.my_partner() and d.value = objects.name)
  ));

-- ---------- Хүсэлт илгээх (анкеттай) ----------
drop function if exists public.submit_loan_request(uuid, uuid, text, text, bigint, int, text, text, boolean);

create or replace function public.submit_loan_request(
  p_ad uuid, p_partner uuid, p_down bigint, p_term int, p_app jsonb, p_docs jsonb, p_consent boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.ads; lp public.leasing_partners; me public.profiles; rid uuid; m bigint;
  v_name text := trim(coalesce(p_app->>'full_name', ''));
  v_phone text := trim(coalesce(p_app->>'phone', ''));
  v_rd text := upper(regexp_replace(coalesce(p_app->>'register_no', ''), '\s', '', 'g'));
  v_birth date; v_age int;
  v_emp text := coalesce(p_app->>'employment_type', '');
  v_work int; v_income bigint; v_other bigint; v_debt bigint; v_overdue boolean;
  v_cos jsonb := case when jsonb_typeof(p_app->'cosigner') = 'object' then p_app->'cosigner' end;
  v_cos_income bigint := 0;
  v_app jsonb; v_docs jsonb := '{}'::jsonb; v_checks jsonb := '[]'::jsonb;
  v_dti numeric; v_loan bigint; k text; pth text; ok boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Нэвтэрнэ үү'; end if;
  if me.is_blocked then raise exception 'Таны аккаунт хаагдсан байна'; end if;
  if not coalesce(p_consent, false) then raise exception 'Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү'; end if;
  if jsonb_typeof(p_app) is distinct from 'object' then raise exception 'Анкетаа бөглөнө үү'; end if;

  select * into a from public.ads where id = p_ad and status = 'active';
  if a.id is null then raise exception 'Зар идэвхтэй биш байна'; end if;
  if a.user_id = auth.uid() then raise exception 'Өөрийн зарт хүсэлт илгээх боломжгүй'; end if;
  select * into lp from public.leasing_partners where id = p_partner and active;
  if lp.id is null then raise exception 'Лизингийн компани олдсонгүй'; end if;
  if p_term is null or p_term < 1 or p_term > lp.max_term_months then raise exception 'Хугацаа % сараас хэтрэхгүй', lp.max_term_months; end if;
  if p_down is null or p_down < 0 or p_down >= a.price then raise exception 'Урьдчилгаа буруу байна'; end if;
  if p_down < ceil(a.price * lp.min_down_pct / 100) then
    raise exception 'Урьдчилгаа хамгийн багадаа үнийн % хувь байна', trim_scale(lp.min_down_pct);
  end if;
  if exists (select 1 from public.loan_requests r where r.user_id = auth.uid() and r.ad_id = p_ad and r.partner_id = p_partner and r.status in ('new','contacted')) then
    raise exception 'Энэ зарт хүсэлт аль хэдийн илгээсэн байна';
  end if;

  -- Анкет шалгах
  if v_name = '' then raise exception 'Овог нэрээ оруулна уу'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then raise exception 'Утасны дугаараа зөв оруулна уу'; end if;
  v_birth := public.rd_birth_date(v_rd);
  if v_birth is null or v_birth > current_date then raise exception 'Регистрийн дугаар буруу байна (жишээ: УБ99112233)'; end if;
  v_age := extract(year from age(current_date, v_birth))::int;
  if coalesce(trim(p_app->>'city'), '') = '' or coalesce(trim(p_app->>'address'), '') = '' then raise exception 'Оршин суугаа хаягаа бөглөнө үү'; end if;
  if coalesce(p_app->>'marital_status', '') not in ('single','married','divorced','widowed') then raise exception 'Гэрлэлтийн байдлаа сонгоно уу'; end if;
  if coalesce(p_app->>'household_size', '') !~ '^[0-9]{1,2}$' or (p_app->>'household_size')::int not between 1 and 30 then raise exception 'Ам бүлийн тоогоо оруулна уу'; end if;
  if v_emp not in ('salary','business','both','pension','other') then raise exception 'Орлогын эх үүсвэрээ сонгоно уу'; end if;
  if v_emp in ('salary','both') and coalesce(trim(p_app->>'employer'), '') = '' then raise exception 'Ажлын газраа оруулна уу'; end if;
  if coalesce(p_app->>'work_months', '') !~ '^[0-9]{1,3}$' then raise exception 'Ажилласан / бизнес эрхэлсэн хугацаагаа (сараар) оруулна уу'; end if;
  v_work := (p_app->>'work_months')::int;
  if coalesce(p_app->>'monthly_income', '') !~ '^[0-9]{1,12}$' or (p_app->>'monthly_income')::bigint <= 0 then raise exception 'Сарын орлогоо оруулна уу'; end if;
  v_income := (p_app->>'monthly_income')::bigint;
  v_other := case when coalesce(p_app->>'other_income', '') ~ '^[0-9]{1,12}$' then (p_app->>'other_income')::bigint else 0 end;
  v_debt := case when coalesce(p_app->>'existing_debt_payment', '') ~ '^[0-9]{1,12}$' then (p_app->>'existing_debt_payment')::bigint else 0 end;
  if jsonb_typeof(p_app->'has_overdue') is distinct from 'boolean' then raise exception 'Хугацаа хэтэрсэн зээлтэй эсэхээ сонгоно уу'; end if;
  v_overdue := (p_app->>'has_overdue')::boolean;
  if coalesce(trim(p_app->>'ref_name'), '') = '' or length(regexp_replace(coalesce(p_app->>'ref_phone', ''), '\D', '', 'g')) < 8 then
    raise exception 'Яаралтай үед холбоо барих хүний нэр, утсыг оруулна уу';
  end if;
  if v_cos is not null then
    if coalesce(trim(v_cos->>'name'), '') = '' or length(regexp_replace(coalesce(v_cos->>'phone', ''), '\D', '', 'g')) < 8 then
      raise exception 'Хамтран зээлдэгчийн нэр, утсыг оруулна уу';
    end if;
    v_cos_income := case when coalesce(v_cos->>'monthly_income', '') ~ '^[0-9]{1,12}$' then (v_cos->>'monthly_income')::bigint else 0 end;
  end if;

  -- Баримт: зөвхөн өөрийн хавтаснаас, байгаа файл
  if jsonb_typeof(p_docs) = 'object' then
    for k, pth in select key, value from jsonb_each_text(p_docs) loop
      if k = any(public.loan_doc_kinds()) and pth like auth.uid()::text || '/%'
         and exists (select 1 from storage.objects o where o.bucket_id = 'loan-docs' and o.name = pth) then
        v_docs := v_docs || jsonb_build_object(k, pth);
      end if;
    end loop;
  end if;
  foreach k in array lp.required_docs loop
    if k = 'cosigner_id' and v_cos is null then continue; end if;
    if not v_docs ? k then raise exception 'Шаардлагатай баримт дутуу байна: %', k; end if;
  end loop;

  m := public.loan_monthly(a.price - p_down, lp.rate_annual, p_term);
  v_loan := a.price - p_down;
  v_dti := round((v_debt + m)::numeric * 100 / nullif(v_income + v_other + v_cos_income, 0), 2);

  -- Шаардлагын шалгалт (хаахгүй, зөвхөн тэмдэглэнэ)
  v_checks := jsonb_build_array(
    jsonb_build_object('key','age','label','Нас ' || lp.min_age || '–' || lp.max_age, 'value', v_age || ' нас', 'ok', v_age between lp.min_age and lp.max_age),
    jsonb_build_object('key','work','label',
      case when v_emp = 'business' then 'Бизнес эрхэлсэн ' || lp.min_business_months || '+ сар' else 'Ажилласан ' || lp.min_work_months || '+ сар' end,
      'value', v_work || ' сар',
      'ok', case when v_emp in ('pension','other') then null
                 when v_emp = 'business' then v_work >= lp.min_business_months
                 else v_work >= lp.min_work_months end),
    jsonb_build_object('key','dti','label','Өр/орлогын харьцаа ≤ ' || trim_scale(lp.max_dti) || '%', 'value', coalesce(trim_scale(v_dti)::text, '—') || '%', 'ok', v_dti is not null and v_dti <= lp.max_dti),
    jsonb_build_object('key','overdue','label','Хугацаа хэтэрсэн зээлгүй', 'value', case when v_overdue then 'Байгаа' else 'Байхгүй' end, 'ok', not v_overdue)
  );
  if lp.min_car_year is not null then
    v_checks := v_checks || jsonb_build_object('key','car','label','Машин ' || lp.min_car_year || ' оноос хойш', 'value', a.year_made || ' он', 'ok', a.year_made >= lp.min_car_year);
  end if;
  if lp.cosigner_over is not null and v_loan > lp.cosigner_over then
    v_checks := v_checks || jsonb_build_object('key','cosigner','label','Хамтран зээлдэгчтэй (' || to_char(lp.cosigner_over, 'FM999,999,999,999') || '₮-өөс дээш зээлд)', 'value', case when v_cos is null then 'Байхгүй' else 'Байгаа' end, 'ok', v_cos is not null);
  end if;
  select coalesce(bool_and((c->>'ok')::boolean), true) into ok from jsonb_array_elements(v_checks) c where c->>'ok' is not null;

  v_app := jsonb_strip_nulls(jsonb_build_object(
    'register_no', v_rd, 'birth_date', v_birth, 'age', v_age,
    'city', trim(p_app->>'city'), 'district', nullif(trim(p_app->>'district'), ''), 'address', trim(p_app->>'address'),
    'marital_status', p_app->>'marital_status', 'household_size', (p_app->>'household_size')::int,
    'employment_type', v_emp, 'employer', nullif(trim(p_app->>'employer'), ''), 'position', nullif(trim(p_app->>'position'), ''),
    'work_months', v_work, 'monthly_income', v_income, 'other_income', v_other, 'existing_debt_payment', v_debt,
    'has_overdue', v_overdue, 'has_license', case when jsonb_typeof(p_app->'has_license') = 'boolean' then (p_app->>'has_license')::boolean end,
    'ref_name', trim(p_app->>'ref_name'), 'ref_phone', trim(p_app->>'ref_phone'), 'ref_relation', nullif(trim(p_app->>'ref_relation'), ''),
    'cosigner', case when v_cos is null then null else jsonb_strip_nulls(jsonb_build_object(
      'name', trim(v_cos->>'name'), 'phone', trim(v_cos->>'phone'), 'relation', nullif(trim(v_cos->>'relation'), ''),
      'register_no', nullif(upper(regexp_replace(coalesce(v_cos->>'register_no', ''), '\s', '', 'g')), ''), 'monthly_income', v_cos_income)) end
  ));

  insert into public.loan_requests(ad_id, user_id, partner_id, full_name, phone, car, price, down_payment, term_months,
                                   rate_annual, monthly_payment, income, note, consent, applicant, docs, checks, checks_ok, dti)
  values (a.id, auth.uid(), lp.id, v_name, v_phone, a.brand || ' ' || a.model || ' · ' || a.year_made,
          a.price, p_down, p_term, lp.rate_annual, m, to_char(v_income, 'FM999,999,999,999') || '₮', nullif(trim(p_app->>'note'), ''), true,
          v_app, v_docs, v_checks, ok, v_dti)
  returning id into rid;

  insert into public.notifications(user_id, type, title, body, ad_id)
  select p.id, 'loan_request', 'Лизингийн шинэ хүсэлт' || case when ok then ' ✓' else '' end,
         v_name || ' · ' || a.brand || ' ' || a.model || ' · ' || to_char(v_loan, 'FM999,999,999,999') || '₮, ' || p_term || ' сар',
         a.id
  from public.profiles p
  where not p.is_blocked and ((p.role = 'leasing' and p.partner_id = lp.id) or p.role = 'admin');
  perform public.log_action('Лизингийн хүсэлт: ' || a.brand || ' ' || a.model || ' → ' || lp.name, a.id);
  return rid;
end $$;

-- ---------- Нөхцөл, шаардлага тохируулах (түншийн ажилтан эсвэл админ) ----------
drop function if exists public.set_partner_terms(numeric, numeric, int);

create or replace function public.set_partner_terms(p_partner uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rate numeric; v_down numeric; v_term int; v_min_age int; v_max_age int; v_work int; v_bus int;
  v_dti numeric; v_car int; v_cos bigint; v_docs text[];
begin
  begin
    v_rate := (p->>'rate_annual')::numeric;
    v_down := (p->>'min_down_pct')::numeric;
    v_term := (p->>'max_term_months')::int;
    v_min_age := (p->>'min_age')::int;
    v_max_age := (p->>'max_age')::int;
    v_work := (p->>'min_work_months')::int;
    v_bus := (p->>'min_business_months')::int;
    v_dti := (p->>'max_dti')::numeric;
    v_car := nullif(p->>'min_car_year', '')::int;
    v_cos := nullif(p->>'cosigner_over', '')::bigint;
  exception when others then
    raise exception 'Тоон утга буруу байна';
  end;
  if p_partner is null or not (public.is_admin() or coalesce(p_partner = public.my_partner(), false)) then raise exception 'Эрх хүрэхгүй'; end if;
  if v_rate is null or v_rate < 0 or v_rate > 100 then raise exception 'Жилийн хүү 0–100%% байна'; end if;
  if v_down is null or v_down < 0 or v_down >= 100 then raise exception 'Урьдчилгаа 0–99%% байна'; end if;
  if v_term is null or v_term not between 1 and 120 then raise exception 'Хугацаа 1–120 сар байна'; end if;
  if v_min_age is null or v_max_age is null or v_min_age < 16 or v_max_age > 100 or v_min_age > v_max_age then raise exception 'Насны хязгаар буруу байна'; end if;
  if v_work is null or v_work not between 0 and 240 or v_bus is null or v_bus not between 0 and 240 then raise exception 'Ажилласан хугацаа 0–240 сар байна'; end if;
  if v_dti is null or v_dti <= 0 or v_dti > 100 then raise exception 'Өр/орлогын харьцаа 1–100%% байна'; end if;
  if v_car is not null and v_car not between 1950 and 2100 then raise exception 'Машины он буруу байна'; end if;
  if v_cos is not null and v_cos < 0 then raise exception 'Хамтран зээлдэгчийн босго буруу байна'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_docs
  from jsonb_array_elements_text(coalesce(p->'required_docs', '[]'::jsonb)) x where x = any(public.loan_doc_kinds());
  update public.leasing_partners set
    rate_annual = v_rate, min_down_pct = v_down, max_term_months = v_term,
    min_age = v_min_age, max_age = v_max_age, min_work_months = v_work, min_business_months = v_bus,
    max_dti = v_dti, min_car_year = v_car, cosigner_over = v_cos, required_docs = v_docs,
    requirements_note = nullif(trim(p->>'requirements_note'), ''), updated_at = now()
  where id = p_partner;
  if not found then raise exception 'Компани олдсонгүй'; end if;
end $$;

revoke execute on function public.submit_loan_request(uuid, uuid, bigint, int, jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.set_partner_terms(uuid, jsonb) from public, anon;
grant execute on function public.submit_loan_request(uuid, uuid, bigint, int, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.set_partner_terms(uuid, jsonb) to authenticated;
grant execute on function public.rd_birth_date(text) to authenticated;
grant execute on function public.loan_doc_kinds() to anon, authenticated;

notify pgrst, 'reload schema';
