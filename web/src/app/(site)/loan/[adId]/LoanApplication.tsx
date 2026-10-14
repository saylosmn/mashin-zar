"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STEPS,
  applicantPayload,
  draftKey,
  emptyForm,
  fromApplicant,
  packDocs,
  readDraft,
  toInt,
  validateStep,
  writeDraft,
  type LoanForm,
  type SetField,
} from "@shared/loan-form";
import { createClient } from "@/lib/supabase/client";
import { errMsg, num } from "@/lib/format";
import {
  DEFAULT_REQUIRED_DOCS,
  LOAN_DOCS,
  ageFrom,
  docBase,
  docLabel,
  monthlyPayment,
  previewChecks,
  rdBirthDate,
  type Applicant,
  type Partner,
} from "@/lib/loan";
import { IconSpinner } from "@/components/icons";
import { Notice, StepList, Summary } from "@/features/loan/controls";
import { ContactsStep, IncomeStep, PersonalStep, ReviewStep } from "@/features/loan/steps";
import { DocsStep, type LoanDoc } from "@/features/loan/DocsStep";

const LAST_STEP = STEPS.length - 1;

type Defaults = {
  full_name: string;
  phone: string;
  city: string;
  applicant: Applicant | null;
  docs: Record<string, string>;
};

function initialForm(d: Defaults): LoanForm {
  const base = emptyForm(d);
  return d.applicant ? fromApplicant(base, d.full_name, d.phone, d.applicant) : base;
}

/** Өмнөх хүсэлтийн баримтыг дахин хуулах шаардлагагүй, шууд ашиглана */
function initialDocs(d: Defaults): Record<string, LoanDoc> {
  const known = Object.entries(d.docs ?? {}).filter(([k]) => LOAN_DOCS.some((x) => x.kind === docBase(k)));
  return Object.fromEntries(known.map(([k, path]) => [k, { path, name: "Өмнөх хүсэлтээс", reused: true }]));
}

export function LoanApplication({
  userId,
  ad,
  partner,
  down,
  term,
  defaults,
}: {
  userId: string;
  ad: { id: string; price: number; year: number; title: string };
  partner: Partner;
  down: number;
  term: number;
  defaults: Defaults;
}) {
  const router = useRouter();
  const key = draftKey(ad.id, partner.id);
  const [form, setForm] = useState(() => initialForm(defaults));
  const [docs, setDocs] = useState(() => initialDocs(defaults));
  const [batch, setBatch] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);
  const draftLoaded = useRef(false);

  const set: SetField = useCallback((k) => (v) => setForm((f) => ({ ...f, [k]: v })), []);

  // Ноорогийг эхний зурсны дараа сэргээнэ (серверийн HTML-тэй зөрөхгүйн тулд)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      draftLoaded.current = true;
      const d = readDraft<LoanDoc>(key);
      if (!d) return;
      setForm((f) => ({ ...f, ...d.f }));
      setDocs(d.docs ?? {});
      if (d.batch) setBatch(d.batch);
      setStep(Math.min(Math.max(Number(d.step) || 0, 0), LAST_STEP));
      setRestored(true);
    });
    return () => cancelAnimationFrame(id);
  }, [key]);

  useEffect(() => {
    if (!draftLoaded.current || done) return;
    const t = setTimeout(() => writeDraft(key, { step, batch, reused: [], docs, f: form }), 400);
    return () => clearTimeout(t);
  }, [key, done, step, batch, docs, form]);

  const required = useMemo(
    () => (partner.required_docs ?? DEFAULT_REQUIRED_DOCS).filter((k) => k !== "cosigner_id" || form.hasCos),
    [partner.required_docs, form.hasCos],
  );
  const loan = ad.price - down;
  const monthly = monthlyPayment(loan, Number(partner.rate_annual), term);
  const birth = rdBirthDate(form.rd);
  const { checks, dti } = previewChecks({
    partner,
    age: birth ? ageFrom(birth) : null,
    employment: form.emp,
    workMonths: Number(form.work) || 0,
    income: toInt(form.income),
    otherIncome: toInt(form.other),
    cosignerIncome: form.hasCos ? toInt(form.cosIncome) : 0,
    debt: toInt(form.debt),
    monthly,
    hasOverdue: form.overdue,
    carYear: ad.year,
    loan,
    hasCosigner: form.hasCos,
  });

  function go(n: number) {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    const e = validateStep(step, form, required, docs);
    if (e) return setError(e);
    go(step + 1);
  }

  async function submit() {
    for (let s = 0; s < LAST_STEP; s++) {
      const e = validateStep(s, form, required, docs);
      if (e) {
        setStep(s);
        setError(e);
        return;
      }
    }
    if (!consent) return setError("Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү");
    setBusy(true);
    setError(null);
    const attached = Object.entries(packDocs(docs)).filter(([k]) => docBase(k) !== "cosigner_id" || form.hasCos);
    const { error: e } = await createClient().rpc("submit_loan_request", {
      p_ad: ad.id,
      p_partner: partner.id,
      p_down: down,
      p_term: term,
      p_app: applicantPayload(form),
      p_docs: Object.fromEntries(attached.map(([k, d]) => [k, d.path])),
      p_consent: true,
    });
    if (e) {
      setBusy(false);
      // DB "… дутуу байна: ndsh" гэж буцаадаг - түлхүүрийг баримтын нэрээр солино
      return setError(errMsg(e).replace(/дутуу байна: ([a-z_0-9]+)/, (_m, k: string) => `дутуу байна: ${docLabel(k)}`));
    }
    setDone(true);
    writeDraft(key, null);
    router.push(`/loans?ok=${encodeURIComponent(`${partner.name}-д хүсэлт илгээгдлээ`)}`);
  }

  const stepProps = { form, set, partner };

  return (
    <div className="flex flex-col gap-4">
      <Summary
        items={[
          { label: "Машин", value: ad.title },
          { label: "Урьдчилгаа", value: `${num(down)}₮` },
          { label: "Хугацаа", value: `${term} сар · ${Number(partner.rate_annual)}%` },
          { label: "Сарын төлбөр", value: `${num(monthly)}₮`, strong: true },
        ]}
      />
      <StepList steps={STEPS} current={step} />
      {restored && <Notice tone="ok">Өмнө бөглөсөн мэдээллийг сэргээлээ.</Notice>}

      <section className="card flex flex-col gap-4 p-5">
        {step === 0 && <PersonalStep {...stepProps} />}
        {step === 1 && <IncomeStep {...stepProps} dti={dti} />}
        {step === 2 && (
          <ContactsStep
            {...stepProps}
            needCosigner={partner.cosigner_over != null && loan > Number(partner.cosigner_over)}
          />
        )}
        {step === 3 && (
          <DocsStep
            userId={userId}
            batch={batch}
            partner={partner}
            docs={docs}
            setDocs={setDocs}
            required={required}
            hasCosigner={form.hasCos}
            onError={setError}
            uploading={uploading}
            setUploading={setUploading}
          />
        )}
        {step === 4 && <ReviewStep {...stepProps} checks={checks} consent={consent} onConsent={setConsent} />}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex gap-2 pt-1">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} disabled={busy} className="btn btn-ghost flex-1">
              ← Буцах
            </button>
          )}
          {step < LAST_STEP ? (
            <button type="button" onClick={next} disabled={!!uploading} className="btn btn-ink flex-[2]">
              Үргэлжлүүлэх →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={busy || done || !consent}
              className="btn btn-yellow flex-[2] disabled:opacity-50"
            >
              {busy ? (
                <>
                  <IconSpinner size={18} /> Илгээж байна
                </>
              ) : (
                "Хүсэлт илгээх"
              )}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
