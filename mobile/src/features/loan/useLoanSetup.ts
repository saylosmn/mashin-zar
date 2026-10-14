import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errMsg } from "@/lib/format";
import { LOAN_DOCS, docBase, type Applicant, type Partner } from "@/lib/loan";
import { emptyForm, fromApplicant, packDocs, readDraft, type Draft, type LoanForm } from "@shared/loan-form";

export type AdLite = {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year_made: number;
  price: number;
  status: string;
};

type Previous = { full_name: string; phone: string; applicant: Applicant; docs?: Record<string, string> | null };

type Setup = {
  ad: AdLite | null;
  partner: Partner | null;
  /** Энэ машинд энэ компанид илгээсэн, шийдвэрлэгдээгүй хүсэлт */
  existingId: string | null;
  form: LoanForm;
  docs: Record<string, string>;
  reused: string[];
  draft: Draft<string> | null;
};

/**
 * Зар, лизингийн компанийг ачаалж анкетын анхны утгыг бэлдэнэ:
 * ноорог байвал түүгээр, үгүй бол хамгийн сүүлийн хүсэлтээр урьдчилан бөглөнө.
 */
export function useLoanSetup(
  adId: string,
  partnerId: string,
  uid: string,
  profile: Parameters<typeof emptyForm>[0],
  draftKey: string,
) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: Setup | null }>({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ad, partner, last, open] = await Promise.all([
          supabase
            .from("public_ads")
            .select("id,user_id,brand,model,year_made,price,status")
            .eq("id", adId)
            .maybeSingle(),
          supabase.from("leasing_partners").select("*").eq("id", partnerId).eq("active", true).maybeSingle(),
          supabase
            .from("loan_requests")
            .select("full_name,phone,applicant,docs")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("loan_requests")
            .select("id")
            .eq("user_id", uid)
            .eq("ad_id", adId)
            .eq("partner_id", partnerId)
            .in("status", ["new", "contacted"])
            .limit(1)
            .maybeSingle(),
        ]);
        if (ad.error) throw ad.error;

        let form = emptyForm(profile);
        let docs: Record<string, string> = {};
        let reused: string[] = [];
        const prev = last.data as Previous | null;
        if (prev?.docs) {
          const kinds = new Set(LOAN_DOCS.map((d) => d.kind));
          const valid = Object.entries(prev.docs).filter(
            ([k, v]) => kinds.has(docBase(k)) && typeof v === "string" && v,
          );
          docs = packDocs(Object.fromEntries(valid));
          reused = Object.values(docs);
        }
        if (prev?.applicant) form = fromApplicant(form, prev.full_name, prev.phone, prev.applicant);

        const draft = readDraft<string>(draftKey);
        if (draft) {
          form = { ...form, ...draft.f };
          docs = packDocs(draft.docs ?? {});
          reused = draft.reused ?? [];
        }

        if (alive)
          setState({
            loading: false,
            error: null,
            data: {
              ad: ad.data as AdLite | null,
              partner: partner.data as Partner | null,
              existingId: (open.data as { id: string } | null)?.id ?? null,
              form,
              docs,
              reused,
              draft,
            },
          });
      } catch (e) {
        if (alive) setState({ loading: false, error: errMsg(e), data: null });
      }
    })();
    return () => {
      alive = false;
    };
    // profile нь зөвхөн анхны утга тул dependency-д оруулаагүй
  }, [adId, partnerId, uid, draftKey]);

  return state;
}
