import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data";
import { minDown, termOptions, type Applicant, type Partner } from "@/lib/loan";
import { LoanApplication } from "./LoanApplication";

export const metadata = { title: "Лизингийн хүсэлт" };

export default async function LoanPage({ params, searchParams }: { params: Promise<{ adId: string }>; searchParams: Promise<{ partner?: string; down?: string; term?: string }> }) {
  const { adId } = await params;
  const sp = await searchParams;
  const me = await requireUser(`/loan/${adId}?partner=${sp.partner ?? ""}&down=${sp.down ?? ""}&term=${sp.term ?? ""}`);
  const supabase = await createClient();
  const [adRes, pRes, lastRes] = await Promise.all([
    supabase.from("public_ads").select("id,user_id,brand,model,year_made,price,status").eq("id", adId).maybeSingle(),
    supabase.from("leasing_partners").select("*").eq("id", sp.partner ?? "00000000-0000-0000-0000-000000000000").eq("active", true).maybeSingle(),
    supabase.from("loan_requests").select("full_name,phone,applicant").eq("user_id", me.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ad = adRes.data as { id: string; user_id: string; brand: string; model: string; year_made: number; price: number; status: string } | null;
  const partner = pRes.data as Partner | null;

  const stop = (title: string, text: string) => (
    <main className="max-w-[640px] w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-4">
      <h1 className="h-display m-0 text-[26px]">{title}</h1>
      <p className="m-0 text-body">{text}</p>
      <Link href={ad ? `/ads/${ad.id}` : "/"} className="btn btn-ink self-start">← Буцах</Link>
    </main>
  );
  if (!ad || ad.status !== "active") return stop("Зар идэвхтэй биш байна", "Энэ зар зарагдсан эсвэл нуугдсан байж магадгүй.");
  if (ad.user_id === me.id) return stop("Өөрийн зар", "Өөрийн зарт лизингийн хүсэлт илгээх боломжгүй.");
  if (!partner) return stop("Лизингийн компани олдсонгүй", "Зарын хуудаснаас лизингийн компаниа дахин сонгоно уу.");

  const terms = termOptions(partner.max_term_months);
  const reqTerm = Number(sp.term);
  const term = terms.includes(reqTerm) ? reqTerm : terms.includes(24) ? 24 : terms[terms.length - 1];
  const min = minDown(ad.price, partner.min_down_pct);
  const reqDown = Math.round(Number(sp.down) || 0);
  const down = reqDown >= min && reqDown < ad.price ? reqDown : min;
  const last = lastRes.data as { full_name: string; phone: string; applicant: Applicant } | null;

  return (
    <main className="max-w-[760px] w-full mx-auto px-4 sm:px-6 pt-6 pb-16 flex flex-col gap-5">
      <Link href={`/ads/${ad.id}`} className="text-[14px] text-muted no-underline">← {ad.brand} {ad.model} · {ad.year_made}</Link>
      <div className="flex flex-col gap-1">
        <h1 className="h-display m-0 text-[clamp(24px,3vw,30px)]">Лизингийн хүсэлт</h1>
        <span className="text-[14px] text-muted">{partner.name} · анкет бөглөж, баримтаа хавсаргана</span>
      </div>
      <LoanApplication
        userId={me.id}
        ad={{ id: ad.id, price: ad.price, year: ad.year_made, title: `${ad.brand} ${ad.model} · ${ad.year_made}` }}
        partner={partner}
        down={down}
        term={term}
        defaults={{ full_name: last?.full_name ?? me.full_name ?? "", phone: last?.phone ?? me.phone ?? "", city: me.city ?? "Улаанбаатар", applicant: last?.applicant ?? null }}
      />
    </main>
  );
}
