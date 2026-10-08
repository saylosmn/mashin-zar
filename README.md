# Машин зар

Автомашины зарын marketplace — вэб, апп хоёр **нэг Supabase** (өгөгдлийн сан + Google нэвтрэлт + зургийн сан) ашиглана.

| Хавтас | Юу вэ | Хаана ажиллана |
|---|---|---|
| `web/` | Next.js вэб сайт + менежер панел (`/manager`) + админ панел (`/admin`) | Vercel |
| `mobile/` | Expo (React Native) апп — Android / iOS | Таны утас (EAS build) |
| `supabase/schema.sql` | Хүснэгт, эрхийн хамгаалалт (RLS), менежер/админы үйлдлүүд | Supabase SQL Editor |

## Апп-ыг компьютер дээрээ ажиллуулах

```bash
git clone https://github.com/saylosmn/mashin-zar
cd mashin-zar/mobile
npm install
npx expo start
```
Утсандаа **Expo Go** суулгаад QR кодыг уншуулна.

> Push мэдэгдэл Expo Go дээр ажиллахгүй. Жинхэнэ апп (APK) хийхдээ доорх алхмыг хийнэ.

## APK гаргах (EAS)

Windows дээр хамгийн хялбар нь: `mobile/build-apk.bat` файл дээр 2 удаа дарна.
Build дуусахад гарах `.apk` холбоосыг вэбийн **Админ → Тохиргоо → Апп татах (APK)** хэсэгт оруулна.
Ингэснээр сайтын **Апп татах** товч (`/app` хуудас) тэр холбоос руу заана.

Гараар хийх бол:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init          # app.json-д projectId нэмнэ
npx eas-cli@latest build -p android --profile preview
```
Build дуусахад гарах холбоосоор APK татаж утсандаа суулгана.
Кодоо засаад шууд шинэчлэх: `npx eas-cli@latest update --auto`

## Supabase тохиргоо

1. SQL Editor дээр `supabase/schema.sql`-ийг ажиллуулна (дахин ажиллуулахад аюулгүй). Өмнө нь ажиллуулсан бол зөвхөн `fix-02-realtime.sql`.
2. Authentication → Providers → **Google** асаана.
3. Authentication → **URL Configuration**:
   - Site URL: `https://<таны-vercel-домэйн>`
   - Redirect URLs: `https://<таны-vercel-домэйн>/**`, `mashinzar://**`, `exp://**`
4. Өөрийгөө админ болгох (SQL Editor):
   ```sql
   insert into public.staff_invites(email, role) values ('таны@gmail.com','admin')
     on conflict (email) do update set role='admin';
   update public.profiles set role='admin' where lower(email)=lower('таны@gmail.com');
   ```

## Эрхүүд
- **Хэрэглэгч** — зар үзэх, профайл үүсгэх, зар тавих (менежер шалгана), өөрийн зарыг устгах, мэдэгдэл авах.
- **Менежер** — шинэ зар батлах/татгалзах, бүтэн улсын/арлын дугаар харах, хэрэглэгчтэй холбогдсоноо тэмдэглэх, үнийн **%**-иар санал илгээх, зарагдсан болгох, самбар.
- **Админ** — бүх эрх: менежер нэмэх/хасах, аккаунт хаах/нээх, бүх зар засах/устгах, санал тооцох хувь, 2016 заагийн он, мэдэгдлийн тохиргоо.

## Шууд шинэчлэл (realtime)
Зар нэмэгдэх, батлагдах, зарагдах, устгагдах, аккаунт хаагдах, тохиргоо өөрчлөгдөх бүрт өгөгдлийн сангийн trigger
`mz-sync` суваг руу дохио илгээнэ. Вэб (`LiveSync`) болон апп (`useLiveSync`) энэ дохиогоор refresh-гүйгээр шинэчлэгдэнэ.

## Апп автоматаар build/update хийх (GitHub Actions + Release)

Нэг удаагийн тохиргоо:
1. expo.dev → Account settings → Access tokens → **Create token** → хуулна.
2. GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**
   нэр: `EXPO_TOKEN`, утга: хуулсан токен.
3. Repo **private** бол: GitHub → Settings → Developer settings → Fine-grained tokens → энэ repo,
   Permissions → **Contents: Read-only** → токен үүсгэнэ → Vercel → Project → Settings →
   Environment Variables → `GH_RELEASE_TOKEN` = токен → Redeploy. (Repo public бол энэ алхам хэрэггүй.)
4. GitHub → Actions → **Mobile (EAS Update / Build)** → Run workflow.

Үүний дараа:
- `mobile/` доторх код өөрчлөгдөх бүрт → EAS Update → суулгасан апп дээр "Шинэчлэх" мөр гарна.
- `app.json`, `package.json`, `eas.json`, `assets/` өөрчлөгдвөл → шинэ APK build →
  GitHub Release-д `mashin-zar.apk` болж хавсрагдана → сайтын "Апп татах" (`/app/download`) товч
  хамгийн сүүлийн Release-ээс шууд татна.

## Push мэдэгдэл (Android)
1. Supabase SQL Editor дээр `supabase/fix-03-push.sql` ажиллуулна (push-ийг өгөгдлийн сангаас илгээнэ).
2. Firebase (console.firebase.google.com) → төсөл → Android апп `mn.mashinzar.app` нэмж `google-services.json` татна →
   `mobile/google-services.json` болгож repo-д нэмнэ (энэ файл нууц биш).
3. Firebase → Project settings → Service accounts → **Generate new private key** →
   expo.dev → mashin-zar → Credentials → Android → **FCM V1 service account key** → Upload. (Энэ файлыг хэнд ч бүү өг.)
4. Push хийхэд workflow шинэ APK (хувилбар автоматаар +1) бүтээж Release-д тавина; хуучин апп-д "Шинэ хувилбар гарлаа · Татах" гарна.
