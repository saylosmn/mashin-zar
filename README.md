# Autoshop.mn

Автомашины зарын платформ: вэб сайт, Android апп, админ панел. Вэб болон апп нэг Supabase project
(Postgres + Auth + Storage + Realtime) ашигладаг.

```
web/        Next.js 16 (App Router) - сайт, админ панел, лизингийн панел, API route-ууд   → Vercel
mobile/     Expo (React Native) - Android апп                                              → EAS Build / Update
shared/     Вэб, апп хоёулаа ашигладаг TypeScript: төрлүүд, шимтгэл, лизинг, зар оруулах урсгал
supabase/   schema.sql (бүтэн схем), migrations/, tests/
sms-app/    Банкны орлогын SMS-ийг /api/sms руу дамжуулдаг жижиг Android апп
```

## Хөгжүүлэлт

```bash
# вэб
cd web && npm install && npm run dev          # http://localhost:3000

# апп
cd mobile && npm install && npx expo start    # Expo Go-оор QR уншуулна (push ажиллахгүй)
```

`web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://autoshop.mn        # заавал биш (sitemap, OG, агентын холбоос)
PUSH_SECRET=...                                 # DB → /api/push/web
VAPID_PRIVATE_KEY=...                           # вэб push
GH_RELEASE_TOKEN=...                            # repo private бол "Апп татах" APK-д
```

Апп-ын түлхүүрүүд `mobile/eas.json` болон `mobile/.env.example`-д.

`shared/`-ийг вэб `@shared/*` (tsconfig paths + `turbopack.root`), апп Metro-ийн `watchFolders`-оор
уншдаг. Тусдаа npm package биш.

## Өгөгдлийн сан

- Шинэ project: `supabase/schema.sql`-ийг SQL Editor-оор бүтнээр нь ажиллуулна (idempotent).
- Ажиллаж буй project: `supabase/migrations/`-аас ажиллуулаагүй файлуудыг дарааллаар нь.
- Google нэвтрэлт: Authentication → Providers → Google. Redirect URL-д сайтын домэйн,
  `mashinzar://**`, `exp://**`.
- `pg_cron` (зарын хугацааны сануулга) болон `pg_net` (push) extension-уудыг асаана.

Эхний админ:

```sql
insert into public.staff_invites(email, role) values ('you@gmail.com', 'admin')
  on conflict (email) do update set role = 'admin';
update public.profiles set role = 'admin' where lower(email) = lower('you@gmail.com');
```

## Эрхүүд

| Эрх | |
|---|---|
| Хэрэглэгч | Зар үзэх, тавих (шалгалтаар), чат, лизингийн хүсэлт |
| Авто худалдаа | Зар нь шалгалтгүй шууд нийтлэгдэнэ, өөрсдөө засна/нууна |
| Агент | Өөрийн кодоор ирсэн зарын шимтгэлээс хувь авна (`/agent`) |
| Лизинг | Өөрийн компанийн хүсэлтүүд, шаардлага (`/leasing`) |
| Админ | Бүгд: зар шалгах, төлбөр, тайлан, аккаунт, тохиргоо (`/admin`) |

Эрхийг зөвхөн админ өөрчилнө. `profiles.role`-ийг клиентээс бичих эрх байхгүй, DB trigger давхар шалгадаг.

## Зар оруулах

1. Шимтгэлтэй: гэрээнд гарын үсэг зурна → админ шалгаж нийтэлнэ → зарагдвал шатлалтай шимтгэл.
2. Онцлох (шимтгэлгүй): `/pay/<id>` дээр данс, гүйлгээний утга (`MZXXXXXX`) гарна → SMS апп орлогыг
   барьж `sms_ingest()` автоматаар батална → зар шууд нийтлэгдэнэ.

Урсгал нь `shared/ad-post.ts` (`publishAd`) - вэб, апп хоёулаа үүнийг ашигладаг.

## Апп build

`mobile/` өөрчлөгдөхөд GitHub Actions (`mobile.yml`):

- JS өөрчлөлт → `eas update` (суулгасан апп дараа нээгдэхдээ татна)
- `app.json` / `package.json` / `assets/` өөрчлөлт → APK build → GitHub Release (`mashin-zar.apk`),
  сайтын `/app/download` хамгийн сүүлийн Release-ээс татна

Шаардлагатай secret: `EXPO_TOKEN`. Push-д `mobile/google-services.json` болон EAS дээр FCM V1 түлхүүр.

## Аюулгүй байдал

- `web/src/proxy.ts` + `web/src/lib/shield.ts`: сканнерын хаяг, халдлагын хэрэгслийн User-Agent,
  IP тутмын rate limit, хэт том хүсэлтийг Supabase руу очихоос өмнө хаана.
- CSP, HSTS, COOP/CORP толгойнууд `web/next.config.ts`-д.
- RLS бүх хүснэгт дээр. Ажилтны үйлдлүүд `security definer` функцээр, эрхийг дотор нь шалгана.
- Хэрэглэгч тутам өдрийн лимит: зар, зураг, гэрээ, чат, гомдол, утас харах.

## Тест

```bash
cd web && npm test              # unit (shared/ логик, shield, мэдэгдлийн чиглүүлэлт)
cd web && npm run lint && npm run typecheck
cd mobile && npm run typecheck
```

SQL: `supabase/tests/stubs.sql` → `schema.sql` → `supabase/tests/flows.sql`. CI (`ci.yml`) үүнийг
`schema.sql` болон `migrations/` хоёр замаар ажиллуулдаг.
