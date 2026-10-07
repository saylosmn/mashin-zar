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

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init          # app.json-д projectId нэмнэ
npx eas-cli@latest build -p android --profile preview
```
Build дуусахад гарах холбоосоор APK татаж утсандаа суулгана.
Кодоо засаад шууд шинэчлэх: `npx eas-cli@latest update --auto`

## Supabase тохиргоо

1. SQL Editor дээр `supabase/schema.sql`-ийг ажиллуулна (дахин ажиллуулахад аюулгүй).
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
