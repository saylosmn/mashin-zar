import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { errMsg, timeAgo } from "@/lib/format";
import { openWebPanel, staffRpc } from "@/lib/staff";
import { DEFAULT_REQUIRED_DOCS, EMPLOYMENT, LOAN_DOCS, LOAN_STATUS, MARITAL, docLabel, fmtNum, requirementLines, type LoanRequest, type LoanStatus, type Partner } from "@/lib/loan";
import { Button, Field, Input, Skeleton, StateView, T, s } from "./ui";

type Tab = LoanStatus | "all" | "terms";
const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "Шинэ" },
  { key: "contacted", label: "Холбогдсон" },
  { key: "approved", label: "Зөвшөөрсөн" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
  { key: "terms", label: "Нөхцөл" },
];
type Stat = { status: LoanStatus; price: number; down_payment: number; created_at: string };

/** Лизингийн түншийн панел: хүсэлтүүд, төлөв, зээлийн нөхцөл. Админ бүх түншийг сонгож харна. */
export function LeasingPanel({ withBack }: { withBack?: boolean }) {
  const { profile } = useAuth();
  const admin = profile?.role === "admin";
  const allowed = admin || profile?.role === "leasing";
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [rows, setRows] = useState<LoanRequest[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const partner = partners ? (admin ? partners.find((p) => p.id === pid) ?? partners[0] : partners.find((p) => p.id === profile?.partner_id)) : undefined;
  const partnerId = partner?.id;

  const loadPartners = useCallback(async () => {
    const { data, error: e } = await supabase.from("leasing_partners").select("*").order("name");
    if (e) setError(errMsg(e));
    setPartners((data ?? []) as Partner[]);
  }, []);

  const loadRows = useCallback(async () => {
    if (!partnerId) { setLoading(false); return; }
    try {
      setError(null);
      let q = supabase.from("loan_requests").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(200);
      if (tab !== "all" && tab !== "terms") q = q.eq("status", tab);
      const [list, all] = await Promise.all([
        q,
        supabase.from("loan_requests").select("status,price,down_payment,created_at").eq("partner_id", partnerId),
      ]);
      if (list.error) throw list.error;
      setRows((list.data ?? []) as LoanRequest[]);
      setStats((all.data ?? []) as Stat[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [partnerId, tab]);

  useEffect(() => { if (allowed) loadPartners(); }, [allowed, loadPartners]);
  useEffect(() => { if (partners) loadRows(); }, [partners, loadRows]);
  useLiveSync((e) => { if (e.table === "leasing_partners") loadPartners(); else loadRows(); }, ["loan_requests", "leasing_partners"]);

  const backBtn = withBack ? (
    <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
      <Feather name="chevron-left" size={22} color={C.ink} />
    </Pressable>
  ) : null;

  if (!allowed)
    return <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг лизингийн түнш, админд нээлттэй."><Button title="Буцах" onPress={() => (withBack ? router.back() : router.replace("/"))} /></StateView>;
  if (!partners)
    return <View style={{ padding: 16, gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 110, borderRadius: 14 }} />)}</View>;
  if (!partner)
    return (
      <StateView
        icon="briefcase"
        title="Лизингийн панел"
        text={admin ? "Лизингийн компани бүртгэгдээгүй байна. Вэб админ → Лизинг хэсгээс нэмнэ үү." : "Таны аккаунт лизингийн компанитай холбогдоогүй байна. Админтай холбогдоно уу."}
      >
        {admin ? <Button title="Вэб админ → Лизинг" icon="external-link" onPress={() => openWebPanel("/admin/leasing")} /> : null}
        {withBack ? <Button title="Буцах" variant="ghost" onPress={() => router.back()} /> : null}
      </StateView>
    );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const count = (k: LoanStatus) => stats.filter((r) => r.status === k).length;
  const month = stats.filter((r) => r.created_at >= monthStart);
  const approved = stats.filter((r) => r.status === "approved");
  const decided = approved.length + count("rejected");
  const trialDays = partner.trial_until ? Math.ceil((new Date(partner.trial_until).getTime() - now.getTime()) / 864e5) : null;

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {backBtn}
        <View style={{ flex: 1, gap: 2 }}>
          <T w="display" style={{ fontSize: 20 }} numberOfLines={1}>{partner.name}</T>
          <T style={{ fontSize: 12, color: C.muted }}>Лизингийн хүсэлтүүд{admin ? " · Админ" : ""}</T>
        </View>
      </View>
      {admin && partners.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {partners.map((p) => <Chip key={p.id} on={p.id === partner.id} text={p.name} onPress={() => { setLoading(true); setPid(p.id); }} />)}
        </ScrollView>
      )}
      {trialDays !== null && (
        <View style={{ backgroundColor: trialDays > 0 ? C.ink : C.dangerBg, borderRadius: 12, padding: 12 }}>
          <T style={{ fontSize: 13, lineHeight: 19, color: trialDays > 0 ? C.paper : "#9B1C1C" }}>
            {trialDays > 0 ? <>🎁 Туршилтын хугацаа: <T w="bold" style={{ fontSize: 13, color: C.yellow }}>{trialDays} хоног</T> үлдсэн — үнэгүй.</> : "Туршилтын хугацаа дууссан. Үргэлжлүүлэх нөхцөлийг админтай тохирно уу."}
          </T>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Kpi dark label="Шинэ хүсэлт" value={String(count("new"))} onPress={() => { setLoading(true); setTab("new"); }} />
        <Kpi label="Энэ сар" value={String(month.length)} sub={`${fmtNum(month.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮ зээл`} />
        <Kpi label="Зөвшөөрсөн" value={String(approved.length)} sub={`${fmtNum(approved.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮`} />
        <Kpi label="Хөрвөлт" value={decided ? `${Math.round((approved.length / decided) * 100)}%` : "—"} sub="Шийдвэрлэснээс" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {TABS.map((t) => (
          <Chip
            key={t.key}
            on={t.key === tab}
            text={`${t.label}${t.key !== "all" && t.key !== "terms" ? ` · ${count(t.key)}` : ""}`}
            onPress={() => { if (t.key !== tab) { setLoading(t.key !== "terms"); setTab(t.key); } }}
          />
        ))}
      </ScrollView>
      {tab === "terms" && <Terms partner={partner} editable={admin || profile?.partner_id === partner.id} onSaved={loadPartners} />}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={loading || tab === "terms" ? [] : rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: withBack ? 8 : 12, gap: 10, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { loadPartners(); }} tintColor={C.ink} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          tab === "terms" ? null : loading ? (
            <View style={{ gap: 10 }}>{[0, 1].map((i) => <Skeleton key={i} style={{ height: 170, borderRadius: 14 }} />)}</View>
          ) : error ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 30 }}>
              <T style={{ color: C.danger, textAlign: "center" }}>{error}</T>
              <Button small title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); loadRows(); }} />
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 36 }}>
              <Feather name="inbox" size={32} color={C.pale} />
              <T style={{ color: C.muted }}>Энд хүсэлт алга байна</T>
            </View>
          )
        }
        renderItem={({ item }) => <RequestCard r={item} onDone={loadRows} />}
      />
    </KeyboardAvoidingView>
  );
}

function RequestCard({ r, onDone }: { r: LoanRequest; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const st = LOAN_STATUS[r.status];

  async function setStatus(status: LoanStatus) {
    setBusy(status);
    const res = await staffRpc("update_loan_request", { p_id: r.id, p_status: status, p_note: note.trim() || null });
    setBusy(null);
    if (res.ok) { setNote(""); onDone(); }
  }

  return (
    <View style={[s.card, { padding: 14, gap: 10 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T w="bold" style={{ fontSize: 16 }}>{r.full_name}</T>
          <T style={{ fontSize: 12, color: C.muted }}>{timeAgo(r.created_at)}{r.income ? ` · Орлого: ${r.income}` : ""}</T>
        </View>
        <View style={{ backgroundColor: st.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
          <T w="semibold" style={{ fontSize: 11, color: st.fg }}>{st.label}</T>
        </View>
      </View>
      <Pressable disabled={!r.ad_id} onPress={() => r.ad_id && router.push(`/ads/${r.ad_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name="truck" size={15} color={C.ink} />
        <T w="semibold" style={{ fontSize: 14, textDecorationLine: r.ad_id ? "underline" : "none" }}>{r.car}</T>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Cell k="Машины үнэ" v={`${fmtNum(r.price)}₮`} />
        <Cell k="Урьдчилгаа" v={`${fmtNum(r.down_payment)}₮`} />
        <Cell k="Зээлийн дүн" v={`${fmtNum(r.price - r.down_payment)}₮`} />
        <Cell k="Хугацаа" v={`${r.term_months} сар · ${Number(r.rate_annual)}%`} />
        <Cell k="Сарын төлбөр" v={`${fmtNum(r.monthly_payment)}₮`} strong />
      </View>
      {r.checks && r.checks.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {r.checks.map((c) => (
            <View key={c.key} style={{ backgroundColor: c.ok === true ? "#DDF3E4" : c.ok === false ? C.dangerBg : C.soft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <T w="semibold" style={{ fontSize: 11, color: c.ok === true ? "#1D6B3A" : c.ok === false ? "#9B1C1C" : C.body }}>{c.ok === true ? "✓" : c.ok === false ? "✗" : "–"} {c.label}: {c.value}</T>
            </View>
          ))}
        </View>
      ) : null}
      {r.applicant && Object.keys(r.applicant).length > 0 ? <ApplicantDetails r={r} /> : null}
      {r.docs && Object.keys(r.docs).length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(r.docs).map(([k, path]) => (
            <Pressable key={k} onPress={() => openDoc(path)} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
              <Feather name="paperclip" size={12} color={C.ink} />
              <T style={{ fontSize: 12 }}>{docLabel(k)}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {r.note ? <T style={{ fontSize: 13, color: C.body }}>Худалдан авагч: {r.note}</T> : null}
      {r.partner_note ? <T style={{ fontSize: 13, backgroundColor: C.paper, padding: 8, borderRadius: 8 }}>Тэмдэглэл: {r.partner_note}</T> : null}
      <Button small title={r.phone} icon="phone" variant="yellow" onPress={() => Linking.openURL(`tel:${r.phone.replace(/\s/g, "")}`)} />
      {r.status === "cancelled" ? (
        <T style={{ fontSize: 13, color: C.muted }}>Худалдан авагч хүсэлтээ цуцалсан.</T>
      ) : (
        <View style={{ gap: 8 }}>
          <Input value={note} onChangeText={setNote} placeholder="Тэмдэглэл (худалдан авагчид харагдана)" style={{ height: 44 }} />
          <View style={{ flexDirection: "row", gap: 6 }}>
            {r.status !== "contacted" && <Button small title="Холбогдсон" variant="ghost" loading={busy === "contacted"} disabled={!!busy} style={{ flex: 1 }} onPress={() => setStatus("contacted")} />}
            {r.status !== "approved" && <Button small title="Зөвшөөрөх" variant="ink" loading={busy === "approved"} disabled={!!busy} style={{ flex: 1 }} onPress={() => setStatus("approved")} />}
            {r.status !== "rejected" && <Button small title="Татгалзах" variant="danger" loading={busy === "rejected"} disabled={!!busy} style={{ flex: 1 }} onPress={() => setStatus("rejected")} />}
          </View>
        </View>
      )}
    </View>
  );
}

type TermsForm = Record<"rate" | "min_down" | "max_term" | "min_age" | "max_age" | "min_work" | "min_business" | "max_dti" | "min_car_year" | "cosigner_over" | "note", string>;
const termsFrom = (p: Partner): TermsForm => ({
  rate: String(Number(p.rate_annual)), min_down: String(Number(p.min_down_pct)), max_term: String(p.max_term_months),
  min_age: String(p.min_age ?? 18), max_age: String(p.max_age ?? 65), min_work: String(p.min_work_months ?? 6),
  min_business: String(p.min_business_months ?? 12), max_dti: String(Number(p.max_dti ?? 50)),
  min_car_year: p.min_car_year ? String(p.min_car_year) : "", cosigner_over: p.cosigner_over != null ? fmtNum(Number(p.cosigner_over)) : "",
  note: p.requirements_note ?? "",
});

function Terms({ partner, editable, onSaved }: { partner: Partner; editable: boolean; onSaved: () => void }) {
  const [f, setF] = useState<TermsForm>(() => termsFrom(partner));
  const [docs, setDocs] = useState<string[]>(partner.required_docs ?? DEFAULT_REQUIRED_DOCS);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof TermsForm) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setF(termsFrom(partner));
    setDocs(partner.required_docs ?? DEFAULT_REQUIRED_DOCS);
  }, [partner]);

  async function save() {
    setSaved(false);
    const need: (keyof TermsForm)[] = ["rate", "min_down", "max_term", "min_age", "max_age", "min_work", "min_business", "max_dti"];
    if (need.some((k) => !f[k].trim() || !Number.isFinite(Number(f[k].replace(",", "."))))) return Alert.alert("Буруу утга", "Тоон талбаруудыг зөв бөглөнө үү.");
    setBusy(true);
    const n = (k: keyof TermsForm) => f[k].replace(",", ".").trim();
    const res = await staffRpc("set_partner_terms", {
      p_partner: partner.id,
      p: {
        rate_annual: n("rate"), min_down_pct: n("min_down"), max_term_months: n("max_term"), min_age: n("min_age"), max_age: n("max_age"),
        min_work_months: n("min_work"), min_business_months: n("min_business"), max_dti: n("max_dti"),
        min_car_year: n("min_car_year"), cosigner_over: f.cosigner_over.replace(/\D/g, ""), required_docs: docs, requirements_note: f.note,
      },
    });
    setBusy(false);
    if (res.ok) { setSaved(true); onSaved(); }
  }

  if (!editable)
    return (
      <View style={[s.section]}>
        <T w="bold" style={s.h2}>Нөхцөл ба шаардлага</T>
        {requirementLines(partner).map((l) => <T key={l} style={{ fontSize: 13, color: C.body }}>• {l}</T>)}
        <T style={{ fontSize: 13, color: C.body }}>• Баримт: {(partner.required_docs ?? DEFAULT_REQUIRED_DOCS).map(docLabel).join(", ") || "заавал хавсаргах баримтгүй"}</T>
      </View>
    );

  const numField = (k: keyof TermsForm, label: string, decimal = false, placeholder?: string) => (
    <View style={{ flexBasis: "47%", flexGrow: 1 }}>
      <Field label={label}><Input mono keyboardType={decimal ? "decimal-pad" : "number-pad"} value={f[k]} onChangeText={set(k)} placeholder={placeholder} /></Field>
    </View>
  );

  return (
    <View style={[s.section]}>
      <T w="bold" style={s.h2}>Нөхцөл ба шаардлага</T>
      <T style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>Тооцоолуур, хүсэлтийн анкет энэ тохиргоог ашиглана. Хүсэлт бүрийг систем шаардлагатай тулгаж ✓/✗ гэж харуулна.</T>
      <T w="semibold" style={{ fontSize: 14 }}>Зээлийн нөхцөл</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {numField("rate", "Жилийн хүү (%)", true)}
        {numField("min_down", "Мин урьдчилгаа (%)", true)}
        {numField("max_term", "Макс хугацаа (сар)")}
      </View>
      <T w="semibold" style={{ fontSize: 14 }}>Зээлдэгчид тавих шаардлага</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {numField("min_age", "Доод нас")}
        {numField("max_age", "Дээд нас")}
        {numField("min_work", "Ажилласан (сар)")}
        {numField("min_business", "Бизнес (сар)")}
        {numField("max_dti", "Өр/орлого ≤ (%)", true)}
        {numField("min_car_year", "Машины он ≥", false, "Хязгааргүй")}
      </View>
      <Field label="Хамтран зээлдэгч шаардах зээл (₮-өөс дээш)">
        <Input mono keyboardType="number-pad" value={f.cosigner_over} onChangeText={(v) => set("cosigner_over")(v.replace(/\D/g, "") ? fmtNum(Number(v.replace(/\D/g, ""))) : "")} placeholder="Шаардахгүй" />
      </Field>
      <T w="semibold" style={{ fontSize: 14 }}>Заавал хавсаргах баримт</T>
      <View style={{ gap: 6 }}>
        {LOAN_DOCS.map((d) => {
          const on = docs.includes(d.kind);
          return (
            <Pressable key={d.kind} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setDocs((x) => (on ? x.filter((k) => k !== d.kind) : [...x, d.kind]))} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.paper, borderRadius: 10, padding: 10 }}>
              <Feather name={on ? "check-square" : "square"} size={20} color={C.ink} />
              <T style={{ fontSize: 13, flex: 1 }}>{d.label}</T>
            </Pressable>
          );
        })}
      </View>
      <Field label="Нэмэлт шаардлага (худалдан авагчид харагдана)">
        <Input value={f.note} onChangeText={set("note")} multiline style={{ minHeight: 80 }} placeholder="Жишээ: 100% даатгал заавал" />
      </Field>
      {saved ? <T style={{ fontSize: 13, color: C.activeFg }}>✓ Хадгалагдлаа</T> : null}
      <Button title="Хадгалах" icon="check" loading={busy} onPress={save} />
    </View>
  );
}

function Chip({ text, on, onPress }: { text: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}>
      <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>{text}</T>
    </Pressable>
  );
}

function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: "30%", backgroundColor: strong ? C.ink : C.paper, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
      <T style={{ fontSize: 10.5, color: strong ? C.pale : C.muted }}>{k}</T>
      <T w="bold" style={{ fontSize: 13, color: strong ? C.yellow : C.ink }}>{v}</T>
    </View>
  );
}

function Kpi({ label, value, sub, dark, onPress }: { label: string; value: string; sub?: string; dark?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: "45%", backgroundColor: dark ? C.ink : C.card, borderWidth: dark ? 0 : 1, borderColor: C.line, borderRadius: 14, padding: 14, gap: 4, opacity: pressed ? 0.85 : 1 })}
    >
      <T style={{ fontSize: 12, color: dark ? C.pale : C.muted }} numberOfLines={1}>{label}</T>
      <T w="display" style={{ fontSize: 22, color: dark ? C.yellow : C.ink }}>{value}</T>
      {sub ? <T style={{ fontSize: 11, color: dark ? C.pale : C.muted }} numberOfLines={1}>{sub}</T> : null}
    </Pressable>
  );
}

/** Баримтыг 10 минутын түр холбоосоор нээнэ (RLS: зөвхөн тухайн компанийн ажилтан, админ) */
async function openDoc(path: string) {
  const { data, error } = await supabase.storage.from("loan-docs").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return Alert.alert("Нээж чадсангүй", error ? errMsg(error) : "Файл олдсонгүй");
  Linking.openURL(data.signedUrl).catch((e) => Alert.alert("Нээж чадсангүй", errMsg(e)));
}

function ApplicantDetails({ r }: { r: LoanRequest }) {
  const [open, setOpen] = useState(false);
  const a = r.applicant!;
  const m = (n?: number) => (n == null ? "—" : `${fmtNum(n)}₮`);
  const rows: [string, string][] = [
    ["Регистр", `${a.register_no ?? "—"}${a.age != null ? ` · ${a.age} нас` : ""}`],
    ["Хаяг", [a.city, a.district, a.address].filter(Boolean).join(", ") || "—"],
    ["Гэр бүл", `${a.marital_status ? MARITAL[a.marital_status] ?? a.marital_status : "—"} · ам бүл ${a.household_size ?? "—"}`],
    ["Орлогын эх үүсвэр", a.employment_type ? EMPLOYMENT[a.employment_type] ?? a.employment_type : "—"],
    ["Ажлын газар", [a.employer, a.position].filter(Boolean).join(" · ") || "—"],
    ["Ажилласан", a.work_months != null ? `${a.work_months} сар` : "—"],
    ["Сарын орлого", m(a.monthly_income)],
    ["Бусад орлого", m(a.other_income)],
    ["Бусад зээлийн төлбөр", m(a.existing_debt_payment)],
    ["Өр/орлогын харьцаа", r.dti != null ? `${Number(r.dti)}%` : "—"],
    ["Хугацаа хэтэрсэн зээл", a.has_overdue == null ? "—" : a.has_overdue ? "Байгаа" : "Байхгүй"],
    ["Жолооны үнэмлэх", a.has_license == null ? "—" : a.has_license ? "Байгаа" : "Байхгүй"],
    ["Холбоо барих хүн", a.ref_name ? `${a.ref_name}${a.ref_relation ? ` (${a.ref_relation})` : ""} · ${a.ref_phone ?? ""}` : "—"],
  ];
  if (a.cosigner) rows.push(["Хамтран зээлдэгч", `${a.cosigner.name}${a.cosigner.relation ? ` (${a.cosigner.relation})` : ""} · ${a.cosigner.phone}${a.cosigner.register_no ? ` · ${a.cosigner.register_no}` : ""} · орлого ${m(a.cosigner.monthly_income)}`]);
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 }}>
        <T w="semibold" style={{ fontSize: 13 }}>Анкет харах</T>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.ink} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
          {rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", gap: 10 }}>
              <T style={{ fontSize: 12, color: C.muted, width: 120 }}>{k}</T>
              <T w="medium" style={{ fontSize: 12, flex: 1 }}>{v}</T>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
