import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { CITIES } from "@/lib/cars";
import {
  DEFAULT_REQUIRED_DOCS, EMPLOYMENT, LOAN_DOCS, MARITAL, MAX_DOC_PAGES, ageFrom, docBase, docLabel, docPage, docPageKeys, fmtNum, minDown,
  monthlyPayment, previewChecks, rdBirthDate, termOptions, type Applicant, type Partner,
} from "@/lib/loan";
import { Button, Field, Input, Skeleton, StateView, T, s } from "@/components/ui";

const STEPS = ["Хувийн", "Ажил, орлого", "Холбоо барих", "Баримт", "Илгээх"];
const digits = (v: string) => v.replace(/\D/g, "");
const money = (v: string) => (digits(v) ? fmtNum(Number(digits(v))) : "");
const num = (v: string) => Number(digits(v)) || 0;
const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type AdLite = { id: string; user_id: string; brand: string; model: string; year_made: number; price: number; status: string };

const LATIN_RD = "Регистрийн үсгийг кирилл үсгээр бичнэ үү (жишээ: УБ99112233)";
const hasLatin = (v: string) => /[A-Za-z]/.test(v);

/** Нэг төрлийн баримтын хуудсуудыг цоорхойгүй болгож kind, kind_2 … дарааллаар дахин дугаарлана */
function packDocs(docs: Record<string, string>): Record<string, string> {
  const groups = new Map<string, { page: number; path: string }[]>();
  for (const [k, path] of Object.entries(docs)) {
    if (!path) continue;
    const { base, page } = docPage(k);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push({ page, path });
  }
  const out: Record<string, string> = {};
  for (const [base, list] of groups) {
    const keys = docPageKeys(base);
    list.sort((a, b) => a.page - b.page).slice(0, MAX_DOC_PAGES).forEach((x, i) => { out[keys[i]] = x.path; });
  }
  return out;
}

/** Анкетын ноорог (апп хаагдсан ч бөглөсөн мэдээлэл алга болохгүй) */
type Draft = {
  v: 1;
  step: number; batch: string; reused: string[]; docs: Record<string, string>;
  f: Record<string, string | boolean | null>;
};
const draftKey = (adId: string, partnerId: string) => `loan-draft:${adId}:${partnerId}`;
function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && d.v === 1 && d.f ? d : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    // хадгалж чадахгүй бол чимээгүй алгасна
  }
}

/** Лизингийн хүсэлтийн анкет: 5 алхам, баримтыг зургаар хавсаргана */
export default function LoanApplication() {
  const params = useLocalSearchParams<{ id: string; partner?: string; down?: string; term?: string }>();
  const { session, profile } = useAuth();
  const uid = session?.user.id ?? "";
  const [ad, setAd] = useState<AdLite | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const batch = useRef(rid());
  const scroll = useRef<ScrollView>(null);
  // Өмнөх хүсэлтээс дахин ашиглаж буй файлууд — storage-аас хэзээ ч устгахгүй
  const reused = useRef<Set<string>>(new Set());
  const dKey = draftKey(params.id ?? "", params.partner ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [rd, setRd] = useState("");
  const [city, setCity] = useState(profile?.city ?? "Улаанбаатар");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [marital, setMarital] = useState("");
  const [household, setHousehold] = useState("");
  const [license, setLicense] = useState<boolean | null>(null);
  const [emp, setEmp] = useState("");
  const [employer, setEmployer] = useState("");
  const [position, setPosition] = useState("");
  const [work, setWork] = useState("");
  const [income, setIncome] = useState("");
  const [other, setOther] = useState("");
  const [debt, setDebt] = useState("");
  const [overdue, setOverdue] = useState<boolean | null>(null);
  const [refName, setRefName] = useState("");
  const [refPhone, setRefPhone] = useState("");
  const [refRel, setRefRel] = useState("");
  const [hasCos, setHasCos] = useState(false);
  const [cosName, setCosName] = useState("");
  const [cosPhone, setCosPhone] = useState("");
  const [cosRel, setCosRel] = useState("");
  const [cosRd, setCosRd] = useState("");
  const [cosIncome, setCosIncome] = useState("");
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, p, last, open] = await Promise.all([
          supabase.from("public_ads").select("id,user_id,brand,model,year_made,price,status").eq("id", params.id).maybeSingle(),
          supabase.from("leasing_partners").select("*").eq("id", params.partner ?? "").eq("active", true).maybeSingle(),
          supabase.from("loan_requests").select("full_name,phone,applicant,docs").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("loan_requests").select("id").eq("user_id", uid).eq("ad_id", params.id).eq("partner_id", params.partner ?? "")
            .in("status", ["new", "contacted"]).limit(1).maybeSingle(),
        ]);
        if (a.error) throw a.error;
        setAd(a.data as AdLite | null);
        setPartner(p.data as Partner | null);
        setExistingId((open.data as { id: string } | null)?.id ?? null);
        // Өмнөх хүсэлтээс анкет, баримтыг урьдчилан бөглөнө
        const l = last.data as { full_name: string; phone: string; applicant: Applicant; docs?: Record<string, string> | null } | null;
        if (l?.docs) {
          const kinds = new Set(LOAN_DOCS.map((d) => d.kind));
          const prev = packDocs(Object.fromEntries(Object.entries(l.docs).filter(([k, v]) => kinds.has(docBase(k)) && typeof v === "string" && v)));
          Object.values(prev).forEach((v) => reused.current.add(v));
          setDocs(prev);
        }
        if (l?.applicant) {
          const d = l.applicant;
          setFullName(l.full_name); setPhone(l.phone);
          setRd(d.register_no ?? ""); if (d.city) setCity(d.city); setDistrict(d.district ?? ""); setAddress(d.address ?? "");
          setMarital(d.marital_status ?? ""); setHousehold(d.household_size ? String(d.household_size) : ""); setLicense(d.has_license ?? null);
          setEmp(d.employment_type ?? ""); setEmployer(d.employer ?? ""); setPosition(d.position ?? ""); setWork(d.work_months != null ? String(d.work_months) : "");
          setIncome(d.monthly_income ? fmtNum(d.monthly_income) : ""); setOther(d.other_income ? fmtNum(d.other_income) : ""); setDebt(d.existing_debt_payment ? fmtNum(d.existing_debt_payment) : "");
          setRefName(d.ref_name ?? ""); setRefPhone(d.ref_phone ?? ""); setRefRel(d.ref_relation ?? "");
          if (d.cosigner) { setHasCos(true); setCosName(d.cosigner.name); setCosPhone(d.cosigner.phone); setCosRel(d.cosigner.relation ?? ""); setCosRd(d.cosigner.register_no ?? ""); setCosIncome(d.cosigner.monthly_income ? fmtNum(d.cosigner.monthly_income) : ""); }
        }
        // Ноорог байвал урьдчилан бөглөснөөс давуу
        const dr = readDraft(dKey);
        if (dr) {
          const f = dr.f;
          const str = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
          const bool = (k: string) => (typeof f[k] === "boolean" ? (f[k] as boolean) : null);
          setFullName(str("fullName")); setPhone(str("phone")); setRd(str("rd")); setCity(str("city") || "Улаанбаатар"); setDistrict(str("district"));
          setAddress(str("address")); setMarital(str("marital")); setHousehold(str("household")); setLicense(bool("license"));
          setEmp(str("emp")); setEmployer(str("employer")); setPosition(str("position")); setWork(str("work")); setIncome(str("income"));
          setOther(str("other")); setDebt(str("debt")); setOverdue(bool("overdue")); setRefName(str("refName")); setRefPhone(str("refPhone"));
          setRefRel(str("refRel")); setHasCos(f.hasCos === true); setCosName(str("cosName")); setCosPhone(str("cosPhone")); setCosRel(str("cosRel"));
          setCosRd(str("cosRd")); setCosIncome(str("cosIncome")); setNote(str("note"));
          setDocs(packDocs(dr.docs ?? {}));
          reused.current = new Set(dr.reused ?? []);
          if (dr.batch) batch.current = dr.batch;
          setStep(Math.min(Math.max(Number(dr.step) || 0, 0), STEPS.length - 1));
          setRestored(true);
        }
      } catch (e) {
        setLoadErr(errMsg(e));
      } finally {
        setLoading(false);
        setHydrated(true);
      }
    })();
  }, [params.id, params.partner, uid, dKey]);

  // Ноорог хадгалах (бичих бүрт биш, 400мс завсарлагатай)
  useEffect(() => {
    if (!hydrated || submitted || existingId) return;
    const t = setTimeout(() => {
      writeDraft(dKey, {
        v: 1, step, batch: batch.current, reused: [...reused.current], docs,
        f: {
          fullName, phone, rd, city, district, address, marital, household, license, emp, employer, position, work, income, other, debt,
          overdue, refName, refPhone, refRel, hasCos, cosName, cosPhone, cosRel, cosRd, cosIncome, note,
        },
      });
    }, 400);
    return () => clearTimeout(t);
  }, [
    hydrated, submitted, existingId, dKey, step, docs, fullName, phone, rd, city, district, address, marital, household, license, emp, employer,
    position, work, income, other, debt, overdue, refName, refPhone, refRel, hasCos, cosName, cosPhone, cosRel, cosRd, cosIncome, note,
  ]);

  // Android-ын "буцах" товч: эхний алхам биш бол өмнөх алхам руу
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (step > 0) {
          setError(null);
          setStep(step - 1);
          scroll.current?.scrollTo({ y: 0, animated: true });
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [step, busy]),
  );

  const terms = partner ? termOptions(partner.max_term_months) : [];
  const reqTerm = Number(params.term);
  const term = terms.includes(reqTerm) ? reqTerm : terms.includes(24) ? 24 : terms[terms.length - 1] ?? 12;
  const min = ad && partner ? minDown(ad.price, partner.min_down_pct) : 0;
  const reqDown = Math.round(Number(params.down) || 0);
  const down = ad && reqDown >= min && reqDown < ad.price ? reqDown : min;
  const loan = ad ? ad.price - down : 0;
  const monthly = partner ? monthlyPayment(loan, Number(partner.rate_annual), term) : 0;
  const required = useMemo(() => (partner?.required_docs ?? DEFAULT_REQUIRED_DOCS).filter((k) => k !== "cosigner_id" || hasCos), [partner, hasCos]);
  const birth = rdBirthDate(rd);
  const age = birth ? ageFrom(birth) : null;

  if (loading) return <View style={{ padding: 16, gap: 12, backgroundColor: C.paper, flex: 1 }}>{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 120, borderRadius: 14 }} />)}</View>;
  if (loadErr) return <StateView icon="warning" title="Алдаа гарлаа" text={loadErr}><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (existingId && !submitted)
    return (
      <StateView icon="check-circle" title="Хүсэлт аль хэдийн илгээсэн" text="Та энэ машинд энэ компанид лизингийн хүсэлт илгээсэн байна. Хариу ирэхийг хүлээнэ үү, явцыг “Лизингийн хүсэлт” хэсгээс харна.">
        <Button title="Хүсэлтээ харах" icon="list" onPress={() => router.replace("/loans")} />
        <Button title="Буцах" variant="ghost" onPress={() => router.back()} />
      </StateView>
    );
  if (!ad || ad.status !== "active") return <StateView icon="slash" title="Зар идэвхтэй биш" text="Энэ зар зарагдсан эсвэл нуугдсан байж магадгүй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (ad.user_id === uid) return <StateView icon="slash" title="Өөрийн зар" text="Өөрийн зарт лизингийн хүсэлт илгээх боломжгүй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (!partner) return <StateView icon="briefcase" title="Лизингийн компани олдсонгүй" text="Зарын дэлгэцээс компаниа дахин сонгоно уу."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  const p = partner;
  const needCos = p.cosigner_over != null && loan > Number(p.cosigner_over);
  const { checks, dti } = previewChecks({
    partner: p, age, employment: emp, workMonths: Number(work) || 0, income: num(income), otherIncome: num(other),
    cosignerIncome: hasCos ? num(cosIncome) : 0, debt: num(debt), monthly, hasOverdue: overdue, carYear: ad.year_made, loan, hasCosigner: hasCos,
  });
  const failed = checks.filter((c) => c.ok === false);
  const maxDti = Number(p.max_dti ?? 50);

  function validate(st: number): string | null {
    if (st === 0) {
      if (!fullName.trim()) return "Овог нэрээ оруулна уу";
      if (digits(phone).length < 8) return "Утасны дугаараа зөв оруулна уу";
      if (hasLatin(rd)) return LATIN_RD;
      if (!birth) return "Регистрийн дугаараа зөв оруулна уу (жишээ: УБ99112233)";
      if (!city || !address.trim()) return "Оршин суугаа хаягаа бөглөнө үү";
      if (!marital) return "Гэрлэлтийн байдлаа сонгоно уу";
      const h = Number(household);
      if (!Number.isInteger(h) || h < 1 || h > 30) return "Ам бүлийн тоогоо оруулна уу";
    }
    if (st === 1) {
      if (!emp) return "Орлогын эх үүсвэрээ сонгоно уу";
      if ((emp === "salary" || emp === "both") && !employer.trim()) return "Ажлын газраа оруулна уу";
      if (!/^\d{1,3}$/.test(work)) return "Ажилласан / бизнес эрхэлсэн хугацаагаа сараар оруулна уу";
      if (num(income) <= 0) return "Сарын орлогоо оруулна уу";
      if (overdue === null) return "Хугацаа хэтэрсэн зээлтэй эсэхээ сонгоно уу";
    }
    if (st === 2) {
      if (!refName.trim() || digits(refPhone).length < 8) return "Яаралтай үед холбоо барих хүний нэр, утсыг оруулна уу";
      if (hasCos && (!cosName.trim() || digits(cosPhone).length < 8)) return "Хамтран зээлдэгчийн нэр, утсыг оруулна уу";
      if (hasCos && hasLatin(cosRd)) return LATIN_RD;
      if (hasCos && cosRd.trim() && !rdBirthDate(cosRd)) return "Хамтран зээлдэгчийн регистр буруу байна";
    }
    if (st === 3) {
      const miss = required.filter((k) => !docs[k]);
      if (miss.length) return `Заавал хавсаргах баримт: ${miss.map(docLabel).join(", ")}`;
    }
    return null;
  }

  function go(n: number) {
    setError(null);
    setStep(n);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function next() {
    const e = validate(step);
    if (e) return setError(e);
    go(step + 1);
  }

  /** Тухайн төрлийн хавсаргасан хуудсуудын түлхүүр (дарааллаар) */
  const pagesOf = (kind: string) => docPageKeys(kind).filter((k) => docs[k]);

  async function pickDoc(kind: string) {
    const key = docPageKeys(kind).find((k) => !docs[k]);
    if (!key) return;
    Alert.alert(docLabel(key), "Баримтаа хэрхэн оруулах вэ?", [
      { text: "Болих", style: "cancel" },
      { text: "Галерей", onPress: () => upload(kind, false) },
      { text: "Зураг авах", onPress: () => upload(kind, true) },
    ]);
  }

  async function upload(kind: string, camera: boolean) {
    setError(null);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Зөвшөөрөл хэрэгтэй", "Тохиргооноос зураг/камерын зөвшөөрөл олгоно уу.");
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    setUploading(kind);
    try {
      const a = res.assets[0];
      const ctx = ImageManipulator.manipulate(a.uri);
      if ((a.width ?? 0) > 2000) ctx.resize({ width: 2000 });
      const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      const buf = await fetch(out.uri).then((r) => r.arrayBuffer());
      const path = `${uid}/${batch.current}/${kind}-${Date.now()}.jpg`;
      const { error: e } = await supabase.storage.from("loan-docs").upload(path, buf, { contentType: "image/jpeg" });
      if (e) throw e;
      setDocs((x) => {
        const key = docPageKeys(kind).find((k) => !x[k]);
        if (!key) {
          supabase.storage.from("loan-docs").remove([path]).then(() => {}, () => {});
          return x;
        }
        return { ...x, [key]: path };
      });
    } catch (e) {
      setError(`Хавсаргаж чадсангүй: ${errMsg(e)}`);
    } finally {
      setUploading(null);
    }
  }

  function removeDoc(key: string) {
    const old = docs[key];
    setDocs((x) => { const y = { ...x }; delete y[key]; return packDocs(y); });
    // Өмнөх хүсэлтийн файлыг устгавал тэр хүсэлтийн баримт алга болно — зөвхөн жагсаалтаас хасна
    if (old && !reused.current.has(old)) supabase.storage.from("loan-docs").remove([old]).then(() => {}, () => {});
  }

  async function submit() {
    if (submitted || busy) return;
    for (let st = 0; st < 4; st++) {
      const e = validate(st);
      if (e) { go(st); setError(e); return; }
    }
    if (!consent) return setError("Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү");
    setBusy(true);
    setError(null);
    const p_app = {
      full_name: fullName.trim(), phone: phone.trim(), register_no: rd, city, district, address, marital_status: marital,
      household_size: household, employment_type: emp, employer, position, work_months: work,
      monthly_income: String(num(income)), other_income: String(num(other)), existing_debt_payment: String(num(debt)),
      has_overdue: overdue, has_license: license, ref_name: refName, ref_phone: refPhone, ref_relation: refRel, note,
      cosigner: hasCos ? { name: cosName, phone: cosPhone, relation: cosRel, register_no: cosRd, monthly_income: String(num(cosIncome)) } : null,
    };
    const p_docs = Object.fromEntries(Object.entries(packDocs(docs)).filter(([k]) => docBase(k) !== "cosigner_id" || hasCos));
    const { error: e } = await supabase.rpc("submit_loan_request", { p_ad: ad!.id, p_partner: p.id, p_down: down, p_term: term, p_app, p_docs, p_consent: true });
    setBusy(false);
    if (e) {
      // "… дутуу байна: ndsh" → баримтын нэрээр
      return setError(errMsg(e).replace(/дутуу байна: (\w+)/, (_m, k: string) => `дутуу байна: ${docLabel(k)}`));
    }
    setSubmitted(true);
    writeDraft(dKey, null);
    Alert.alert("Хүсэлт илгээгдлээ", `${p.name} тантай удахгүй холбогдоно. Явцыг “Лизингийн хүсэлт” хэсгээс харна.`);
    router.replace("/loans");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityLabel="Буцах" onPress={() => (step > 0 ? go(step - 1) : router.back())} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T w="display" style={{ fontSize: 19 }}>Лизингийн хүсэлт</T>
            <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{p.name} · {ad.brand} {ad.model} {ad.year_made}</T>
          </View>
        </View>

        {restored ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.activeBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Feather name="rotate-ccw" size={14} color={C.activeFg} />
            <T style={{ fontSize: 12.5, color: C.activeFg, flex: 1 }}>Өмнө бөглөсөн мэдээллийг сэргээлээ</T>
            <Pressable accessibilityLabel="Хаах" hitSlop={10} onPress={() => setRestored(false)}><Feather name="x" size={14} color={C.activeFg} /></Pressable>
          </View>
        ) : null}

        <View style={{ backgroundColor: C.ink, borderRadius: 14, padding: 14, flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}>
          <Sum k="Урьдчилгаа" v={`${fmtNum(down)}₮`} />
          <Sum k="Хугацаа" v={`${term} сар · ${Number(p.rate_annual)}%`} />
          <Sum k="Зээл" v={`${fmtNum(loan)}₮`} />
          <Sum k="Сарын төлбөр" v={`${fmtNum(monthly)}₮`} strong />
        </View>

        <View style={{ flexDirection: "row", gap: 4 }} accessibilityLabel={`Алхам ${step + 1} / ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((t, i) => (
            <View key={t} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? C.ink : C.line2 }} />
              <T w={i === step ? "semibold" : "body"} style={{ fontSize: 10.5, color: i === step ? C.ink : C.muted }} numberOfLines={1}>{t}</T>
            </View>
          ))}
        </View>

        <View style={[s.section]}>
          {step === 0 && (
            <>
              <T w="bold" style={s.h2}>Хувийн мэдээлэл</T>
              <Field label="Овог нэр"><Input value={fullName} onChangeText={setFullName} autoComplete="name" /></Field>
              <Field label="Утас"><Input mono value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
              <Field label="Регистрийн дугаар" error={hasLatin(rd) ? LATIN_RD : null} hint={birth ? `Төрсөн: ${birth.toISOString().slice(0, 10)} · ${age} нас` : "Жишээ: УБ99112233"}>
                <Input mono value={rd} onChangeText={(v) => setRd(v.toUpperCase())} autoCapitalize="characters" maxLength={12} style={rd && !birth ? { borderColor: C.danger } : undefined} />
              </Field>
              <Field label="Хот / аймаг"><Chips value={city} onChange={setCity} options={Object.fromEntries(CITIES.map((c) => [c, c]))} /></Field>
              <Field label="Дүүрэг / сум"><Input value={district} onChangeText={setDistrict} placeholder="Сүхбаатар" /></Field>
              <Field label="Дэлгэрэнгүй хаяг"><Input value={address} onChangeText={setAddress} placeholder="Хороо, байр, тоот" /></Field>
              <Field label="Гэрлэлтийн байдал"><Chips value={marital} onChange={setMarital} options={MARITAL} /></Field>
              <Field label="Ам бүлийн тоо"><Input mono value={household} onChangeText={(v) => setHousehold(digits(v).slice(0, 2))} keyboardType="number-pad" /></Field>
              <Field label="Жолооны үнэмлэхтэй юу?"><YesNo value={license} onChange={setLicense} /></Field>
            </>
          )}

          {step === 1 && (
            <>
              <T w="bold" style={s.h2}>Ажил, орлого</T>
              <Field label="Орлогын үндсэн эх үүсвэр"><Chips value={emp} onChange={setEmp} options={EMPLOYMENT} /></Field>
              {emp !== "pension" && emp !== "other" && (
                <>
                  <Field label={emp === "business" ? "Бизнесийн нэр / төрөл" : "Ажлын газар"}><Input value={employer} onChangeText={setEmployer} /></Field>
                  <Field label="Албан тушаал"><Input value={position} onChangeText={setPosition} /></Field>
                </>
              )}
              <Field label={emp === "business" ? "Бизнес эрхэлсэн хугацаа (сар)" : "Одоогийн ажилдаа ажилласан (сар)"} hint={`Шаардлага: ${emp === "business" ? p.min_business_months ?? 12 : p.min_work_months ?? 6}+ сар`}>
                <Input mono value={work} onChangeText={(v) => setWork(digits(v).slice(0, 3))} keyboardType="number-pad" />
              </Field>
              <Field label="Сарын цэвэр орлого (₮)"><Input mono value={income} onChangeText={(v) => setIncome(money(v))} keyboardType="number-pad" /></Field>
              <Field label="Бусад орлого (₮, сараар)"><Input mono value={other} onChangeText={(v) => setOther(money(v))} keyboardType="number-pad" placeholder="0" /></Field>
              <Field label="Бусад зээлийн сарын төлбөр (₮)" hint="Банк, ББСБ, утасны зээл бүгдийг нийлүүлнэ"><Input mono value={debt} onChangeText={(v) => setDebt(money(v))} keyboardType="number-pad" placeholder="0" /></Field>
              <Field label="Хугацаа хэтэрсэн зээл байгаа юу?"><YesNo value={overdue} onChange={setOverdue} /></Field>
              {dti != null && (
                <View style={{ backgroundColor: dti <= maxDti ? C.activeBg : C.pendingBg, borderRadius: 12, padding: 12 }}>
                  <T style={{ fontSize: 13, lineHeight: 19, color: dti <= maxDti ? C.activeFg : C.pendingFg }}>
                    Өр/орлогын харьцаа: <T w="bold" style={{ fontSize: 13, color: dti <= maxDti ? C.activeFg : C.pendingFg }}>{dti}%</T> (шаардлага ≤ {maxDti}%){dti > maxDti ? " — хамтран зээлдэгч нэмэх эсвэл урьдчилгаагаа нэмбэл буурна." : ""}
                  </T>
                </View>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <T w="bold" style={s.h2}>Яаралтай үед холбоо барих хүн</T>
              <Field label="Нэр"><Input value={refName} onChangeText={setRefName} /></Field>
              <Field label="Утас"><Input mono value={refPhone} onChangeText={setRefPhone} keyboardType="phone-pad" /></Field>
              <Field label="Таны хэн болох"><Input value={refRel} onChangeText={setRefRel} placeholder="Ах, найз, хамт ажилладаг…" /></Field>
              <View style={{ height: 1, backgroundColor: C.line }} />
              <T w="bold" style={s.h2}>Хамтран зээлдэгч</T>
              {needCos && (
                <View style={{ backgroundColor: C.pendingBg, borderRadius: 12, padding: 12 }}>
                  <T style={{ fontSize: 13, color: C.pendingFg, lineHeight: 19 }}>{p.name} {fmtNum(Number(p.cosigner_over))}₮-өөс дээш зээлд хамтран зээлдэгч шаарддаг.</T>
                </View>
              )}
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: hasCos }} onPress={() => setHasCos(!hasCos)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Feather name={hasCos ? "check-square" : "square"} size={22} color={C.ink} />
                <T style={{ fontSize: 14, flex: 1 }}>Хамтран зээлдэгчтэй (ихэвчлэн гэр бүлийн хүн)</T>
              </Pressable>
              {hasCos && (
                <>
                  <Field label="Нэр"><Input value={cosName} onChangeText={setCosName} /></Field>
                  <Field label="Утас"><Input mono value={cosPhone} onChangeText={setCosPhone} keyboardType="phone-pad" /></Field>
                  <Field label="Таны хэн болох"><Input value={cosRel} onChangeText={setCosRel} placeholder="Эхнэр, нөхөр…" /></Field>
                  <Field label="Регистр (заавал биш)" error={hasLatin(cosRd) ? LATIN_RD : null}><Input mono value={cosRd} onChangeText={(v) => setCosRd(v.toUpperCase())} autoCapitalize="characters" maxLength={12} /></Field>
                  <Field label="Хамтран зээлдэгчийн сарын орлого (₮)"><Input mono value={cosIncome} onChangeText={(v) => setCosIncome(money(v))} keyboardType="number-pad" /></Field>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <T w="bold" style={s.h2}>Баримт бичиг</T>
              <T style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>
                Баримтынхаа зургийг авч эсвэл галерейгаас оруулна. Лавлагааг e-mongolia.mn-ээс татаж, дэлгэцийн зураг (screenshot) хэлбэрээр оруулж болно. Файлууд зөвхөн {p.name}-д харагдана.
              </T>
              <Button small title="e-mongolia.mn нээх" icon="external-link" variant="ghost" onPress={() => Linking.openURL("https://e-mongolia.mn")} />
              {Object.values(docs).some((v) => reused.current.has(v)) ? (
                <View style={{ backgroundColor: C.activeBg, borderRadius: 10, padding: 10 }}>
                  <T style={{ fontSize: 12.5, color: C.activeFg, lineHeight: 18 }}>Өмнөх хүсэлтэд хавсаргасан баримтуудыг автоматаар орууллаа. Хуучирсан бол хасаад шинээр оруулна уу.</T>
                </View>
              ) : null}
              {LOAN_DOCS.filter((x) => x.kind !== "cosigner_id" || hasCos).map((x) => {
                const req = required.includes(x.kind);
                const pages = pagesOf(x.kind);
                const have = pages.length > 0;
                const busyKind = uploading === x.kind;
                return (
                  <View key={x.kind} style={{ borderWidth: 1, borderColor: have ? "#9BD3AE" : C.line, backgroundColor: have ? "#F1FAF4" : C.card, borderRadius: 12, padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <T w="semibold" style={{ fontSize: 14, flex: 1 }}>{x.label}</T>
                      {req ? (
                        <View style={{ backgroundColor: C.pendingBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}><T w="semibold" style={{ fontSize: 11, color: C.pendingFg }}>заавал</T></View>
                      ) : <T style={{ fontSize: 11, color: C.muted }}>заавал биш</T>}
                    </View>
                    {!have && x.hint ? <T style={{ fontSize: 12, color: C.muted, lineHeight: 17 }}>{x.hint}</T> : null}
                    {pages.map((k, i) => (
                      <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <T style={{ fontSize: 13, color: "#1D6B3A", flex: 1 }}>✓ {i + 1}-р хуудас{reused.current.has(docs[k]) ? " · өмнөх хүсэлтээс" : ""}</T>
                        <Button small title="Хасах" variant="danger" disabled={!!uploading} onPress={() => removeDoc(k)} />
                      </View>
                    ))}
                    {!have ? (
                      <Button small title="Хавсаргах" icon="paperclip" variant="ink" loading={busyKind} disabled={!!uploading} onPress={() => pickDoc(x.kind)} />
                    ) : pages.length < MAX_DOC_PAGES ? (
                      <Button small title="Хуудас нэмэх" icon="plus" variant="ghost" loading={busyKind} disabled={!!uploading} onPress={() => pickDoc(x.kind)} />
                    ) : (
                      <T style={{ fontSize: 12, color: C.muted }}>Хамгийн ихдээ {MAX_DOC_PAGES} хуудас</T>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {step === 4 && (
            <>
              <T w="bold" style={s.h2}>Шалгаад илгээх</T>
              {checks.map((c) => (
                <View key={c.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.paper, borderRadius: 10, padding: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.ok === true ? "#DDF3E4" : c.ok === false ? C.dangerBg : C.soft }}>
                    <T w="bold" style={{ fontSize: 13, color: c.ok === true ? "#1D6B3A" : c.ok === false ? "#9B1C1C" : C.body }}>{c.ok === true ? "✓" : c.ok === false ? "✗" : "–"}</T>
                  </View>
                  <T style={{ fontSize: 13, flex: 1 }}>{c.label}</T>
                  <T w="semibold" style={{ fontSize: 13 }}>{c.value}</T>
                </View>
              ))}
              {failed.length > 0 && (
                <View style={{ backgroundColor: C.pendingBg, borderRadius: 12, padding: 12 }}>
                  <T style={{ fontSize: 13, color: C.pendingFg, lineHeight: 19 }}>{failed.length} шаардлагыг хангахгүй байна. Хүсэлтээ илгээж болно — эцсийн шийдвэрийг {p.name} гаргана.</T>
                </View>
              )}
              {p.requirements_note ? <T style={{ fontSize: 13, color: C.body, lineHeight: 19 }}>{p.name}: {p.requirements_note}</T> : null}
              <Field label="Нэмэлт тэмдэглэл (заавал биш)"><Input value={note} onChangeText={setNote} multiline style={{ minHeight: 70 }} placeholder="Залгах тохиромжтой цаг гэх мэт" /></Field>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Feather name={consent ? "check-square" : "square"} size={22} color={C.ink} />
                <T style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
                  Энэ анкетын мэдээлэл, хавсаргасан баримтуудыг <T w="bold" style={{ fontSize: 13 }}>{p.name}</T>-д дамжуулж, зээлийн шийдвэр гаргахад ашиглах, надтай холбогдохыг зөвшөөрч байна. Мэдээлэл үнэн зөв гэдгийг баталж байна.
                </T>
              </Pressable>
            </>
          )}

          {error ? (
            <View style={{ backgroundColor: C.dangerBg, borderRadius: 10, padding: 10 }}>
              <T style={{ color: "#9B1C1C", fontSize: 13, lineHeight: 19 }}>{error}</T>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {step > 0 && <Button title="Буцах" variant="ghost" disabled={busy || submitted} style={{ flex: 1 }} onPress={() => go(step - 1)} />}
            {step < 4 ? (
              <Button title="Үргэлжлүүлэх" icon="arrow-right" disabled={!!uploading} style={{ flex: 2 }} onPress={next} />
            ) : (
              <Button title={submitted ? "Илгээгдсэн" : "Хүсэлт илгээх"} icon={submitted ? "check" : "send"} variant="yellow" loading={busy} disabled={!consent || submitted} style={{ flex: 2 }} onPress={submit} />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Sum({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ width: "50%", gap: 2 }}>
      <T style={{ fontSize: 11, color: C.pale }}>{k}</T>
      <T w="bold" style={{ fontSize: strong ? 16 : 14, color: strong ? C.yellow : C.paper }}>{v}</T>
    </View>
  );
}

function Chips({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
      {Object.entries(options).map(([k, l]) => {
        const on = value === k;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(k)} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}>
            <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return <Chips value={value === null ? "" : value ? "y" : "n"} onChange={(v) => onChange(v === "y")} options={{ y: "Тийм", n: "Үгүй" }} />;
}
