import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data";
import { PageMessage } from "@/components/PageMessage";
import { IconLock } from "@/components/icons";

export const metadata = { title: "Аккаунт хаагдсан" };

export default async function BlockedPage() {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (!p.is_blocked) redirect("/");
  return (
    <PageMessage
      icon={
        <div className="w-[120px] h-[120px] rounded-[32px] bg-danger-bg text-[#9b1c1c] flex items-center justify-center">
          <IconLock size={56} />
        </div>
      }
      title="Таны аккаунт түр хаагдсан байна"
      actions={
        <form action="/auth/signout" method="post">
          <button className="btn btn-lg btn-ghost">Өөр аккаунтаар нэвтрэх</button>
        </form>
      }
    >
      <p className="m-0">
        Админ таны аккаунтыг хаасан тул шинэ зар тавих, зараа удирдах боломжгүй. Дэлгэрэнгүйг манай багаас асууна уу.
      </p>
      <p className="m-0 mt-2 text-[14px] text-muted">{p.email}</p>
    </PageMessage>
  );
}
