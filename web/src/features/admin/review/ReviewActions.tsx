import Link from "next/link";
import { approveAd, markContacted, rejectAd } from "@/actions/ads";
import { IconPhone } from "@/components/icons";
import { RejectForm } from "./RejectForm";
import type { ReviewAd } from "./types";

export function ReviewActions({ ad, tab, paymentMissing }: { ad: ReviewAd; tab: string; paymentMissing: boolean }) {
  const back = `/admin/review?tab=${tab}`;
  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {ad.status === "pending" && !ad.contacted_at && (
          <form action={markContacted} className="flex flex-[1_1_160px]">
            <input type="hidden" name="id" value={ad.id} />
            <input type="hidden" name="back" value={`/admin/review?tab=contacted&id=${ad.id}`} />
            <button className="btn btn-lg btn-ghost flex-1">
              <IconPhone size={18} /> Холбогдсон
            </button>
          </form>
        )}
        {ad.status !== "rejected" && ad.status !== "sold" && (
          <RejectForm key={ad.id} id={ad.id} back={back} action={rejectAd} />
        )}
        {(ad.status === "pending" || ad.status === "rejected") && (
          <form action={approveAd} className="flex flex-[2_1_220px]">
            <input type="hidden" name="id" value={ad.id} />
            <input type="hidden" name="back" value={back} />
            <button disabled={paymentMissing} className="btn btn-lg btn-yellow flex-1 disabled:opacity-50">
              {paymentMissing ? "Төлбөр баталгаажаагүй" : "Батлаж нийтлэх"}
            </button>
          </form>
        )}
        {ad.status === "active" && (
          <Link href={`/admin/reports?ad=${ad.id}`} className="btn btn-lg btn-ink flex-[2_1_220px]">
            Зарагдсан гэж бүртгэх
          </Link>
        )}
      </div>
      <span className="text-[12px] text-muted">
        {paymentMissing
          ? "Онцлох (шимтгэлгүй) зар төлбөр баталгаажсаны дараа нийтлэгдэнэ. «Төлбөрүүд»-ээс эсвэл SMS апп автоматаар батална."
          : "Батлагдмагц зар нийтлэгдэж, бүх хэрэглэгчид шинэ зарын мэдэгдэл очно."}
      </span>
    </>
  );
}
