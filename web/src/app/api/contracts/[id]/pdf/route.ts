import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/request";
import { renderContractPdf } from "@/lib/contract-pdf";
import { shortNo, type ContractTerms } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Row = {
  id: string; user_id: string; company_name: string; terms: ContractTerms; full_name: string; phone: string;
  brand: string; model: string; year_made: number | null; plate_number: string; vin: string; price: number;
  signature_svg: string; pdf_path: string | null; signed_at: string;
};

/** Гэрээний PDF-ийг (байхгүй бол үүсгэж хадгалаад) хэдэн минут хүчинтэй холбоосоор өгнө. Эзэмшигч болон менежер, админ л харна. */
async function signedUrl(request: Request, id: string): Promise<{ url?: string; error?: string; status: number }> {
  const supabase = await supabaseForRequest(request);
  const { data, error } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: "Гэрээ олдсонгүй эсвэл харах эрхгүй", status: 404 };
  const c = data as Row;
  let filePath = c.pdf_path;
  if (!filePath) {
    const pdf = await renderContractPdf(
      {
        number: shortNo(c.id), date: c.signed_at, company: c.company_name, terms: c.terms,
        fullName: c.full_name, phone: c.phone, brand: c.brand, model: c.model, yearMade: c.year_made,
        plate: c.plate_number, vin: c.vin, price: c.price,
      },
      c.signature_svg,
    );
    filePath = `${c.user_id}/${c.id}.pdf`;
    const up = await supabase.storage.from("contracts").upload(filePath, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) return { error: `PDF хадгалж чадсангүй: ${up.error.message}`, status: 500 };
    await supabase.rpc("set_contract_pdf", { p_id: c.id, p_path: filePath });
  }
  const s = await supabase.storage.from("contracts").createSignedUrl(filePath, 600, { download: `geree-${shortNo(c.id)}.pdf` });
  if (s.error || !s.data) return { error: s.error?.message ?? "Холбоос үүсгэж чадсангүй", status: 500 };
  return { url: s.data.signedUrl, status: 200 };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await signedUrl(request, (await params).id);
  if (!r.url) return new NextResponse(r.error, { status: r.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.redirect(r.url, 302);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await signedUrl(request, (await params).id);
  return NextResponse.json(r.url ? { url: r.url } : { error: r.error }, { status: r.status });
}
