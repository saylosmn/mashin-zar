import { createClient } from "@/lib/supabase/server";
import { renderContractPdf } from "@/lib/contract-pdf";
import type { ContractTerms } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Загвар нөхцөл өөрчлөгдсөн үед л дахин үүснэ — давтан PDF үүсгэлтээс сэргийлж модульд кэшлэнэ.
let cache: { key: string; pdf: Uint8Array } | null = null;

/** Хэвлэж бөглөх хоосон гэрээний загвар (PDF). Зөвхөн нэвтэрсэн хэрэглэгч; нөхцөлөөр нэг л удаа үүсгээд кэшлэнэ. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new Response("Нэвтэрнэ үү", { status: 401 });

  const { data: s } = await supabase.from("settings").select("company_name,commission_tiers,commission_after").eq("id", 1).maybeSingle();
  const key = JSON.stringify([s?.company_name, s?.commission_tiers, s?.commission_after]);
  if (!cache || cache.key !== key) {
    const terms: ContractTerms = {
      tiers: (s?.commission_tiers as ContractTerms["tiers"]) ?? [{ days: 2, percent: 3 }, { days: 7, percent: 2 }, { days: 10, percent: 1.5 }],
      after: Number(s?.commission_after ?? 1.5),
    };
    cache = { key, pdf: await renderContractPdf({ company: s?.company_name ?? "Autoshop ХХК", terms }) };
  }
  return new Response(Buffer.from(cache.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="geree-zagvar.pdf"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
