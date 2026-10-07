import { SiteHeader } from "@/components/SiteHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { getProfile, unreadCount } from "@/lib/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const unread = profile ? await unreadCount(profile.id) : 0;
  return (
    <>
      <SiteHeader profile={profile} unread={unread} />
      <OfflineBanner />
      <div className="flex-1 flex flex-col">{children}</div>
      <footer className="border-t border-line mt-8">
        <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-wrap justify-between gap-3 text-[13px] text-muted">
          <span>© {new Date().getFullYear()} Машин зар</span>
          <form action="/auth/signout" method="post">
            <button className="underline cursor-pointer bg-transparent border-0 text-muted p-0">Гарах</button>
          </form>
        </div>
      </footer>
    </>
  );
}
