import { SiteHeader } from "@/components/SiteHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LiveSync } from "@/components/LiveSync";
import { MobileTabBar } from "@/components/MobileTabBar";
import { PushPrompt } from "@/components/WebPush";
import { CompareBar } from "@/components/Compare";
import { chatUnread, getProfile, unreadCount } from "@/lib/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const [unread, chats] = profile ? await Promise.all([unreadCount(profile.id), chatUnread()]) : [0, 0];
  return (
    <>
      <SiteHeader profile={profile} unread={unread} chats={chats} />
      {profile && <PushPrompt />}
      <OfflineBanner />
      <LiveSync userId={profile?.id} role={profile?.role} partnerId={profile?.partner_id} />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className={`mt-8 border-t border-line sm:pb-0 ${profile ? "pb-[84px]" : ""}`}>
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-6 py-6 text-[13px] text-muted">
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>© {new Date().getFullYear()} Autoshop.mn</span>
            <a href="/app" className="underline">
              Android апп
            </a>
            <a href="/compare" className="underline">
              Харьцуулах
            </a>
            <a href="/terms" className="underline">
              Үйлчилгээний нөхцөл
            </a>
            <a href="/privacy" className="underline">
              Нууцлалын бодлого
            </a>
          </span>
          {profile && (
            <form action="/auth/signout" method="post">
              <button className="cursor-pointer border-0 bg-transparent p-0 text-muted underline">Гарах</button>
            </form>
          )}
        </div>
      </footer>
      <CompareBar />
      {profile && <MobileTabBar unread={unread} />}
    </>
  );
}
