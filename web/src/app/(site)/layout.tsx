import { SiteHeader } from "@/components/SiteHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LiveSync } from "@/components/LiveSync";
import { MobileTabBar } from "@/components/MobileTabBar";
import { PushPrompt } from "@/components/WebPush";
import { CompareBar } from "@/components/Compare";
import { getProfile, unreadCount } from "@/lib/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const unread = profile ? await unreadCount(profile.id) : 0;
  return (
    <>
      <SiteHeader profile={profile} unread={unread} />
      {profile && <PushPrompt />}
      <OfflineBanner />
      <LiveSync userId={profile?.id} role={profile?.role} partnerId={profile?.partner_id} />
      <div className="flex-1 flex flex-col">{children}</div>
      <footer className={`border-t border-line mt-8 sm:pb-0 ${profile ? "pb-[84px]" : ""}`}>
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-wrap justify-between gap-3 text-[13px] text-muted">
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>© {new Date().getFullYear()} Машин зар</span>
            <a href="/app" className="underline">Android апп</a>
            <a href="/compare" className="underline">Харьцуулах</a>
            <a href="/terms" className="underline">Үйлчилгээний нөхцөл</a>
            <a href="/privacy" className="underline">Нууцлалын бодлого</a>
          </span>
          {profile && (
            <form action="/auth/signout" method="post">
              <button className="underline cursor-pointer bg-transparent border-0 text-muted p-0">Гарах</button>
            </form>
          )}
        </div>
      </footer>
      <CompareBar />
      {profile && <MobileTabBar unread={unread} />}
    </>
  );
}
