import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { normAgentCode } from "@/lib/site";
import { getSettings, requireUser } from "@/lib/data";
import { PostForm } from "./PostForm";
import { termsFrom } from "@/lib/contract";

export const metadata = { title: "Зар нэмэх" };

export default async function PostPage() {
  const me = await requireUser("/post");
  if (!me.profile_completed) redirect("/profile?next=/post");
  const [settings, jar] = await Promise.all([getSettings(), cookies()]);
  return (
    <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">{me.role === "dealer" ? `Авто худалдаа · ${me.shop_name ?? ""} · шууд нийтлэгдэнэ` : "Алхам 2 / 3 · Зарын мэдээлэл → дараа нь гэрээ"}</span>
        <h1 className="h-display m-0 text-[clamp(26px,3vw,36px)]">Зар нэмэх</h1>
      </div>
      <PostForm
        userId={me.id}
        defaultPhone={me.phone ?? ""}
        maxPhotos={settings.max_photos}
        minPhotos={settings.min_photos}
        cutoff={settings.cutoff_year}
        fullName={me.full_name ?? ""}
        contract={termsFrom(settings)}
        dealer={me.role === "dealer"}
        defaultAgentCode={normAgentCode(jar.get("mz_ref")?.value) ?? ""}
      />
    </main>
  );
}
