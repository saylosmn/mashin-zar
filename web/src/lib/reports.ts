import "server-only";
import { createClient } from "./supabase/server";
import { termsFrom, type ContractTerms } from "./contract";
import type { ReportAd } from "@/components/SaleReportForm";
import type { Settings } from "./types";

export type ReportRow = {
  id: string; ad_id: string; sold_price: number; sold_at: string; buyer_name: string | null; buyer_phone: string | null;
  note: string | null; days_on_market: number; commission_percent: number; commission_amount: number;
  status: "pending" | "approved" | "rejected"; admin_note: string | null; reviewed_at: string | null; created_at: string;
  ad: { id: string; brand: string; model: string; year_made: number; plate_number: string; price: number; contract_id: string | null; status: string } | null;
  manager: { full_name: string | null; email: string | null } | null;
};

export const REPORT_SELECT =
  "*, ad:ads(id,brand,model,year_made,plate_number,price,contract_id,status), manager:profiles!sale_reports_manager_id_fkey(full_name,email)";

/** Тайлагнах боломжтой (идэвхтэй) зарууд + тэдгээрийн гэрээний нөхцөл */
export async function reportableAds(settings: Settings): Promise<ReportAd[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ads")
    .select("id,brand,model,year_made,plate_number,price,approved_at,created_at,contract:contracts!ads_contract_id_fkey(terms)")
    .eq("status", "active")
    .order("approved_at", { ascending: false })
    .limit(300);
  const fallback = termsFrom(settings).terms;
  return (data ?? []).map((a) => {
    const c = a.contract as unknown as { terms: ContractTerms } | { terms: ContractTerms }[] | null;
    const terms = (Array.isArray(c) ? c[0]?.terms : c?.terms) ?? fallback;
    return {
      id: a.id,
      label: `${a.brand} ${a.model} · ${a.year_made} · ${a.plate_number} · ${new Intl.NumberFormat("en-US").format(a.price)}₮`,
      price: a.price,
      approved_at: a.approved_at,
      created_at: a.created_at,
      terms,
    };
  });
}
