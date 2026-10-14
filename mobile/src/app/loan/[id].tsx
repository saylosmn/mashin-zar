import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg, num } from "@/lib/format";
import {
  DEFAULT_REQUIRED_DOCS,
  ageFrom,
  docBase,
  docLabel,
  minDown,
  monthlyPayment,
  previewChecks,
  rdBirthDate,
  termOptions,
  type Partner,
} from "@/lib/loan";
import { BackButton, Button, Skeleton, StateView, T, s } from "@/components/ui";
import { Notice, StepBar, Summary } from "@/features/loan/controls";
import { ContactsStep, IncomeStep, PersonalStep, ReviewStep } from "@/features/loan/steps";
import { DocsStep } from "@/features/loan/DocsStep";
import { useLoanSetup, type AdLite } from "@/features/loan/useLoanSetup";
import {
  STEPS,
  applicantPayload,
  draftKey,
  packDocs,
  toInt,
  validateStep,
  writeDraft,
  type LoanForm,
  type SetField,
} from "@shared/loan-form";

const LAST_STEP = STEPS.length - 1;
const newBatchId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export default function LoanScreen() {
  const params = useLocalSearchParams<{ id: string; partner?: string; down?: string; term?: string }>();
  const { session, profile } = useAuth();
  const uid = session?.user.id ?? "";
  const key = draftKey(params.id ?? "", params.partner ?? "");
  const { loading, error, data } = useLoanSetup(params.id ?? "", params.partner ?? "", uid, profile, key);
  const [sent, setSent] = useState(false);

  if (loading)
    return (
      <View style={{ padding: 16, gap: 12, backgroundColor: C.paper, flex: 1 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ height: 120, borderRadius: 14 }} />
        ))}
      </View>
    );

  const back = <Button title="Буцах" onPress={() => router.back()} />;
  if (error || !data)
    return (
      <StateView icon="warning" title="Алдаа гарлаа" text={error ?? ""}>
        {back}
      </StateView>
    );
  const { ad, partner } = data;
  if (data.existingId && !sent)
    return (
      <StateView
        icon="check-circle"
        title="Хүсэлт аль хэдийн илгээсэн"
        text="Та энэ машинд энэ компанид лизингийн хүсэлт илгээсэн байна. Явцыг «Лизингийн хүсэлт» хэсгээс харна."
      >
        <Button title="Хүсэлтээ харах" icon="list" onPress={() => router.replace("/loans")} />
        <Button title="Буцах" variant="ghost" onPress={() => router.back()} />
      </StateView>
    );
  if (!ad || ad.status !== "active")
    return (
      <StateView icon="slash" title="Зар идэвхтэй биш" text="Энэ зар зарагдсан эсвэл нуугдсан байж магадгүй.">
        {back}
      </StateView>
    );
  if (ad.user_id === uid)
    return (
      <StateView icon="slash" title="Өөрийн зар" text="Өөрийн зарт лизингийн хүсэлт илгээх боломжгүй.">
        {back}
      </StateView>
    );
  if (!partner)
    return (
      <StateView icon="briefcase" title="Лизингийн компани олдсонгүй" text="Зарын дэлгэцээс компаниа дахин сонгоно уу.">
        {back}
      </StateView>
    );

  return (
    <Application
      uid={uid}
      ad={ad}
      partner={partner}
      setup={data}
      draftKey={key}
      requestedDown={Number(params.down)}
      requestedTerm={Number(params.term)}
      onSent={() => setSent(true)}
    />
  );
}

function Application({
  uid,
  ad,
  partner: p,
  setup,
  draftKey: dKey,
  requestedDown,
  requestedTerm,
  onSent,
}: {
  uid: string;
  ad: AdLite;
  partner: Partner;
  setup: NonNullable<ReturnType<typeof useLoanSetup>["data"]>;
  draftKey: string;
  requestedDown: number;
  requestedTerm: number;
  onSent: () => void;
}) {
  const draft = setup.draft;
  const [form, setForm] = useState<LoanForm>(setup.form);
  const [docs, setDocs] = useState(setup.docs);
  const [step, setStep] = useState(draft ? Math.min(Math.max(Number(draft.step) || 0, 0), LAST_STEP) : 0);
  const [restored, setRestored] = useState(!!draft);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const batch = useRef(draft?.batch || newBatchId());
  const reused = useRef(new Set(setup.reused));
  const scroll = useRef<ScrollView>(null);

  const set: SetField = useCallback((k) => (v) => setForm((f) => ({ ...f, [k]: v })), []);

  // Бичих бүрт биш, 400мс завсарлагатай ноорог хадгална
  useEffect(() => {
    if (submitted) return;
    const t = setTimeout(
      () => writeDraft(dKey, { step, batch: batch.current, reused: [...reused.current], docs, f: form }),
      400,
    );
    return () => clearTimeout(t);
  }, [dKey, submitted, step, docs, form]);

  const go = useCallback((n: number) => {
    setError(null);
    setStep(n);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Android-ын "буцах" товч өмнөх алхам руу шилжинэ
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (step === 0) return false;
        go(step - 1);
        return true;
      });
      return () => sub.remove();
    }, [step, busy, go]),
  );

  const terms = termOptions(p.max_term_months);
  const term = terms.includes(requestedTerm) ? requestedTerm : terms.includes(24) ? 24 : (terms.at(-1) ?? 12);
  const min = minDown(ad.price, p.min_down_pct);
  const wanted = Math.round(requestedDown || 0);
  const down = wanted >= min && wanted < ad.price ? wanted : min;
  const loan = ad.price - down;
  const monthly = monthlyPayment(loan, Number(p.rate_annual), term);
  const required = useMemo(
    () => (p.required_docs ?? DEFAULT_REQUIRED_DOCS).filter((k) => k !== "cosigner_id" || form.hasCos),
    [p, form.hasCos],
  );
  const birth = rdBirthDate(form.rd);
  const { checks, dti } = previewChecks({
    partner: p,
    age: birth ? ageFrom(birth) : null,
    employment: form.emp,
    workMonths: Number(form.work) || 0,
    income: toInt(form.income),
    otherIncome: toInt(form.other),
    cosignerIncome: form.hasCos ? toInt(form.cosIncome) : 0,
    debt: toInt(form.debt),
    monthly,
    hasOverdue: form.overdue,
    carYear: ad.year_made,
    loan,
    hasCosigner: form.hasCos,
  });

  function next() {
    const e = validateStep(step, form, required, docs);
    if (e) return setError(e);
    go(step + 1);
  }

  async function submit() {
    if (submitted || busy) return;
    for (let st = 0; st < LAST_STEP; st++) {
      const e = validateStep(st, form, required, docs);
      if (e) {
        go(st);
        setError(e);
        return;
      }
    }
    if (!consent) return setError("Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү");
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("submit_loan_request", {
      p_ad: ad.id,
      p_partner: p.id,
      p_down: down,
      p_term: term,
      p_app: applicantPayload(form),
      p_docs: Object.fromEntries(
        Object.entries(packDocs(docs)).filter(([k]) => docBase(k) !== "cosigner_id" || form.hasCos),
      ),
      p_consent: true,
    });
    setBusy(false);
    if (e) {
      // DB "… дутуу байна: ndsh" гэж буцаадаг - түлхүүрийг баримтын нэрээр солино
      return setError(errMsg(e).replace(/дутуу байна: (\w+)/, (_m, k: string) => `дутуу байна: ${docLabel(k)}`));
    }
    setSubmitted(true);
    onSent();
    writeDraft(dKey, null);
    Alert.alert("Хүсэлт илгээгдлээ", `${p.name} тантай удахгүй холбогдоно. Явцыг «Лизингийн хүсэлт» хэсгээс харна.`);
    router.replace("/loans");
  }

  const stepProps = { form, set, partner: p };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.paper }}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 14, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Header
          title="Лизингийн хүсэлт"
          subtitle={`${p.name} · ${ad.brand} ${ad.model} ${ad.year_made}`}
          onBack={() => (step > 0 ? go(step - 1) : router.back())}
        />

        {restored && <RestoredBanner onClose={() => setRestored(false)} />}

        <Summary
          items={[
            { label: "Урьдчилгаа", value: `${num(down)}₮` },
            { label: "Хугацаа", value: `${term} сар · ${Number(p.rate_annual)}%` },
            { label: "Зээл", value: `${num(loan)}₮` },
            { label: "Сарын төлбөр", value: `${num(monthly)}₮`, strong: true },
          ]}
        />

        <StepBar steps={STEPS} current={step} />

        <View style={s.section}>
          {step === 0 && <PersonalStep {...stepProps} />}
          {step === 1 && <IncomeStep {...stepProps} dti={dti} />}
          {step === 2 && (
            <ContactsStep {...stepProps} needCosigner={p.cosigner_over != null && loan > Number(p.cosigner_over)} />
          )}
          {step === 3 && (
            <DocsStep
              uid={uid}
              batch={batch.current}
              partner={p}
              docs={docs}
              setDocs={setDocs}
              reused={reused}
              required={required}
              hasCosigner={form.hasCos}
              onError={setError}
              uploading={uploading}
              setUploading={setUploading}
            />
          )}
          {step === 4 && <ReviewStep {...stepProps} checks={checks} consent={consent} onConsent={setConsent} />}

          {error ? <Notice tone="error">{error}</Notice> : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {step > 0 && (
              <Button
                title="Буцах"
                variant="ghost"
                disabled={busy || submitted}
                style={{ flex: 1 }}
                onPress={() => go(step - 1)}
              />
            )}
            {step < LAST_STEP ? (
              <Button
                title="Үргэлжлүүлэх"
                icon="arrow-right"
                disabled={!!uploading}
                style={{ flex: 2 }}
                onPress={next}
              />
            ) : (
              <Button
                title={submitted ? "Илгээгдсэн" : "Хүсэлт илгээх"}
                icon={submitted ? "check" : "send"}
                variant="yellow"
                loading={busy}
                disabled={!consent || submitted}
                style={{ flex: 2 }}
                onPress={submit}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <BackButton onPress={onBack} />
      <View style={{ flex: 1 }}>
        <T w="display" style={{ fontSize: 19 }}>
          {title}
        </T>
        <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
          {subtitle}
        </T>
      </View>
    </View>
  );
}

function RestoredBanner({ onClose }: { onClose: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: C.activeBg,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Feather name="rotate-ccw" size={14} color={C.activeFg} />
      <T style={{ fontSize: 12.5, color: C.activeFg, flex: 1 }}>Өмнө бөглөсөн мэдээллийг сэргээлээ</T>
      <Pressable accessibilityLabel="Хаах" hitSlop={10} onPress={onClose}>
        <Feather name="x" size={14} color={C.activeFg} />
      </Pressable>
    </View>
  );
}
