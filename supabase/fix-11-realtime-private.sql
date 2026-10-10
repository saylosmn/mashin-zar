-- =====================================================================
-- ЗАСВАР 11: Шууд шинэчлэлийн (realtime) сувгийг хувийн болгох
--   Өмнө нь бүх өөрчлөлт (профайл, лизингийн хүсэлт, тайлан, хүлээгдэж буй зар)
--   нийтийн "mz-sync" сувгаар дамждаг байсан. Одоо:
--     * "mz-sync"  (нийтийн)  — зөвхөн нийтэд харагдах зар (идэвхтэй/зарагдсан), лизингийн нөхцөл, тохиргоо
--     * "mz-staff" (хувийн)   — бүх өөрчлөлт, зөвхөн менежер/админ
--     * "u:<id>"   (хувийн)   — тухайн хэрэглэгчийн өөрийн зар, хүсэлт, профайл, тайлан
--     * "p:<id>"   (хувийн)   — тухайн лизингийн компанийн хүсэлтүүд
--   Хувийн сувгийг RLS (realtime.messages) хамгаална.
-- SQL Editor → New query → бүтнээр нь Run. Дахин ажиллуулахад аюулгүй. fix-10-ийн дараа.
-- =====================================================================

create or replace function public.mz_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb; o jsonb; payload jsonb; st text; ost text; uid text; pid text;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    -- Зөвхөн үзэлтийн тоо өөрчлөгдсөн бол дохио илгээхгүй
    if (rec - 'views' - 'updated_at') = (o - 'views' - 'updated_at') then return null; end if;
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

-- Хувийн сувгийг хэн сонсох вэ (realtime.messages дээрх RLS)
do $$
begin
  execute 'alter table realtime.messages enable row level security';
  execute 'drop policy if exists "mz private channels" on realtime.messages';
  execute $p$
    create policy "mz private channels" on realtime.messages for select to authenticated
    using (
      realtime.messages.extension = 'broadcast' and (
        (realtime.topic() = 'mz-staff' and public.is_staff())
        or realtime.topic() = 'u:' || auth.uid()::text
        or (public.my_partner() is not null and realtime.topic() = 'p:' || public.my_partner()::text)
      )
    )
  $p$;
exception when others then
  raise notice 'realtime.messages policy: %', sqlerrm;
end $$;
