-- =====================================================================
-- ЗАСВАР 12: Хэт их өгөгдөл (bloat), спам, буруу форматаас хамгаалах CHECK/лимит
--   Аюулгүй байдлын шалгалтаар өгөгдөл задрах/эрх дээшлэх нүх олдоогүй.
--   Үлдсэн нь зөвхөн хэт их бичилт (bloat) / спам байсан тул энд хаалт тавина:
--     * Зарын текст талбарууд хязгаартай
--     * Лизингийн анкет/баримт/шалгалтын jsonb хэмжээ хязгаартай
--     * Гарын үсэг зөвхөн SVG path тэмдэгт (CPU шавхахаас сэргийлнэ)
--     * Нэг хэрэглэгч хэт олон push төхөөрөмж/захиалга бүртгэхгүй
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй. fix-11-ийн дараа.
-- =====================================================================

-- ---------- 1. Зарын текст талбарын хязгаар ----------
do $$
begin
  alter table public.ads add constraint ads_desc_len  check (char_length(coalesce(description, ''))   <= 4000) not valid;
  alter table public.ads add constraint ads_mod_len   check (char_length(coalesce(modifications, '')) <= 2000) not valid;
  alter table public.ads add constraint ads_brand_len check (char_length(coalesce(brand, '')) <= 60 and char_length(coalesce(model, '')) <= 80 and char_length(coalesce(trim, '')) <= 80) not valid;
  alter table public.ads add constraint ads_id_len    check (char_length(coalesce(plate_number, '')) <= 20 and char_length(coalesce(vin, '')) <= 40) not valid;
  alter table public.ads add constraint ads_opts_len  check (coalesce(array_length(options, 1), 0) <= 60 and coalesce(array_length(photos, 1), 0) <= 30) not valid;
exception when duplicate_object then null;
end $$;

-- ---------- 2. Лизингийн анкет/баримтын jsonb хэмжээ ----------
do $$
begin
  alter table public.loan_requests add constraint loan_applicant_len check (pg_column_size(applicant) <= 8000 and pg_column_size(docs) <= 4000 and pg_column_size(checks) <= 6000) not valid;
  alter table public.loan_requests add constraint loan_text_len check (char_length(coalesce(full_name, '')) <= 120 and char_length(coalesce(phone, '')) <= 40 and char_length(coalesce(note, '')) <= 1000 and char_length(coalesce(partner_note, '')) <= 1000 and char_length(coalesce(car, '')) <= 120) not valid;
exception when duplicate_object then null;
end $$;

-- ---------- 3. Гэрээний гарын үсэг: зөвхөн SVG path тэмдэгт ----------
-- SignaturePad зөвхөн M/L/Z командууд гаргадаг. RPC-г шууд дуудаж дурын урт мөр илгээхээс сэргийлнэ.
do $$
begin
  alter table public.contracts add constraint contracts_sig_fmt
    check (signature_svg ~ '^[MLZmlz0-9 ,.\-\r\n]+$' and char_length(signature_svg) between 20 and 60000) not valid;
  alter table public.contracts add constraint contracts_text_len
    check (char_length(coalesce(full_name, '')) <= 120 and char_length(coalesce(phone, '')) <= 40 and char_length(coalesce(brand, '')) <= 60 and char_length(coalesce(model, '')) <= 80) not valid;
exception when duplicate_object then null;
end $$;

-- ---------- 4. Нэг хэрэглэгчийн push төхөөрөмж/захиалгын тоог хязгаарлах ----------
create or replace function public.cap_rows_per_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= 30 then raise exception 'Хэт олон бүртгэл'; end if;
  return new;
end $$;
revoke execute on function public.cap_rows_per_user() from public, anon, authenticated;

drop trigger if exists push_tokens_cap on public.push_tokens;
create trigger push_tokens_cap before insert on public.push_tokens
for each row execute function public.cap_rows_per_user();

drop trigger if exists web_push_cap on public.web_push_subs;
create trigger web_push_cap before insert on public.web_push_subs
for each row execute function public.cap_rows_per_user();

notify pgrst, 'reload schema';
