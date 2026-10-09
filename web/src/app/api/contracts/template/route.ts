import { createClient } from "@/lib/supabase/server";
import { renderContractPdf } from "@/lib/contract-pdf";
import type { ContractTerms } from "@/lib/contract";

/** Хэвлэж бөглөх хоосон гэрээний загвар (PDF) — одоогийн нөхцөлөөр. */
export async function GET() {
  const supabase = await createClient();
  const { data: s } = await supabase.from("settings").select("company_name,commission_tiers,commission_after").eq("id", 1).maybeSingle();
  const terms: ContractTerms = {
    tiers: (s?.commission_tiers as ContractTerms["tiers"]) ?? [{ days: 2, percent: 3 }, { days: 7, percent: 2 }, { days: 10, percent: 1.5 }],
    after: Number(s?.commission_after ?? 1.5),
  };
  const pdf = await renderContractPdf({ company: s?.company_name ?? "Autoshop ХХК", terms });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="geree-zagvar.pdf"',
      "Cache-Control": "public, s-maxage=300",
    },
  });
}
