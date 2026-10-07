import Link from "next/link";
import { PageMessage } from "@/components/PageMessage";
import { WarnSign } from "@/components/icons";

export const metadata = { title: "Тохиргооны алдаа" };

export default async function SetupError({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const perm = (m ?? "").toLowerCase().includes("permission denied");
  return (
    <PageMessage
      icon={<WarnSign width={200} />}
      title="Өгөгдлийн сангийн тохиргоо дутуу байна"
      actions={
        <>
          <Link href="/" className="btn btn-lg btn-ink">Дахин оролдох</Link>
          <form action="/auth/signout" method="post"><button className="btn btn-lg btn-ghost">Гарах</button></form>
        </>
      }
    >
      <p className="m-0">
        {perm
          ? "Supabase хүснэгтүүдэд эрх олгоогүй байна. SQL Editor дээр supabase/fix-01-grants.sql файлыг ажиллуулаад дахин оролдоно уу."
          : "Нэвтрэлт амжилттай боловч профайл уншихад алдаа гарлаа."}
      </p>
      {m && (
        <p className="m-0 mt-3 text-[13px] text-muted">
          Алдааны дэлгэрэнгүй: <span className="mono text-ink break-all">{m}</span>
        </p>
      )}
    </PageMessage>
  );
}
