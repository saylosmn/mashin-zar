import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { errMsg, timeAgo } from "@/lib/format";
import { confirm, openWebPanel, staffRpc } from "@/lib/staff";
import { DEFAULT_REQUIRED_DOCS, EMPLOYMENT, LOAN_DOCS, LOAN_STATUS, MARITAL, docLabel, docPage, fmtNum, requirementLines, type LoanRequest, type LoanStatus, type Partner } from "@/lib/loan";
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
/** Админ бүх түншийн хүсэлтийг нэг дор харах сонголт */
const ALL = "all";
type LoanEvent = { id: number | string; request_id: string; actor_id: string | null; actor_name: string | null; kind: "submitted" | "status" | "doc_view" | "cancelled"; detail: string | null; created_at: string };

/** Баримтын түлхүүрүүдийг LOAN_DOCS-ийн дараалал, хуудсаар эрэмбэлнэ */
const docOrder = (k: string) => {
  const { base, page } = docPage(k);
  const i = LOAN_DOCS.findIndex((d) => d.kind === base);
  return (i < 0 ? 99 : i) * 10 + page;
};

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

  const allMode = admin && pid === ALL;
  const partner = partners ? (admin ? partners.find((p) => p.id === pid) ?? partners[0] : partners.find((p) => p.id === profile?.partner_id)) : undefined;
  // "Бүгд" горимд түншээр шүүхгүй (зөвхөн админ)
  const partnerId = allMode ? ALL : partner?.id;

  const loadPartners = useCallback(async () => {
    const { data, error: e } = await supabase.from("leasing_partners").select("*").order("name");
    if (e) setError(errMsg(e));
    setPartners((data ?? []) as Partner[]);
  }, []);

  const loadRows = useCallback(async () => {
    if (!partnerId) { setLoading(false); return; }
    try {
      setError(null);
      const everyone = partnerId === ALL;
      let q = supabase.from("loan_requests").select("*").order("created_at", { ascending: false }).limit(200);
      let sq = supabase.from("loan_requests").select("status,price,down_payment,created_at");
      if (!everyone) { q = q.eq("partner_id", partnerId); sq = sq.eq("partner_id", partnerId); }
      if (tab !== "all" && tab !== "terms") q = q.eq("status", tab);
      const [list, all] = await Promise.all([q, sq]);
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
  const trialDays = !allMode && partner.trial_until ? Math.ceil((new Date(partner.trial_until).getTime() - now.getTime()) / 864e5) : null;
  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? "—";
  const tabs = allMode ? TABS.filter((t) => t.key !== "terms") : TABS;
  const pickTab = (k: Tab) => { if (k !== tab) { setLoading(k !== "terms"); setTab(k); } };
  const pickPartner = (id: string) => {
    if (id === (allMode ? ALL : partner.id)) return;
    setLoading(true);
    if (id === ALL && tab === "terms") setTab("new");
    setPid(id);
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {backBtn}
        <View style={{ flex: 1, gap: 2 }}>
          <T w="display" style={{ fontSize: 20 }} numberOfLines={1}>{allMode ? "Бүх компани" : partner.name}</T>
          <T style={{ fontSize: 12, color: C.muted }}>Лизингийн хүсэлтүүд{admin ? " · Админ" : ""}</T>
        </View>
      </View>
      {admin && partners.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip on={allMode} text="Бүгд" onPress={() => pickPartner(ALL)} />
          {partners.map((p) => <Chip key={p.id} on={!allMode && p.id === partner.id} text={p.name} onPress={() => pickPartner(p.id)} />)}
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
        <Kpi dark label="Шинэ хүсэлт" value={String(count("new"))} onPress={() => pickTab("new")} />
        <Kpi label="Энэ сар" value={String(month.length)} sub={`${fmtNum(month.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮ зээл`} />
        <Kpi label="Зөвшөөрсөн" value={String(approved.length)} sub={`${fmtNum(approved.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮`} />
        <Kpi label="Хөрвөлт" value={decided ? `${Math.round((approved.length / decided) * 100)}%` : "—"} sub="Шийдвэрлэснээс" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {tabs.map((t) => (
          <Chip
            key={t.key}
            on={t.key === tab}
            text={`${t.label}${t.key !== "all" && t.key !== "terms" ? ` · ${count(t.key)}` : ""}`}
            onPress={() => pickTab(t.key)}
          />
        ))}
      </ScrollView>
      {tab === "terms" && !allMode && <Terms partner={partner} editable={admin || profile?.partner_id === partner.id} onSaved={loadPartners} />}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={loading || (tab === "terms" && !allMode) ? [] : rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: withBack ? 8 : 12, gap: 10, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { loadPartners(); }} tintColor={C.ink} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          tab === "terms" && !allMode ? null : loading ? (
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
        renderItem={({ item }) => <RequestCard r={item} onDone={loadRows} partnerName={allMode ? partnerName(item.partner_id) : undefined} />}
      />
    </KeyboardAvoidingView>
  );
}

function RequestCard({ r, onDone, partnerName }: { r: LoanRequest; onDone: () => void; partnerName?: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const st = LOAN_STATUS[r.status];

  async function setStatus(status: LoanStatus) {
    if (status === "approved" || status === "rejected") {
      const ok = await confirm(
        status === "approved" ? "Хүсэлтийг зөвшөөрөх үү?" : "Хүсэлтээс татгалзах уу?",
        `${r.full_name} · ${r.car}\n\nХудалдан авагчид ${status === "approved" ? "зөвшөөрсөн" : "татгалзсан"} тухай мэдэгдэл очно.`,
        status === "approved" ? "Зөвшөөрөх" : "Татгалзах",
        status === "rejected",
      );
      if (!ok) return;
    }
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
          {partnerName ? <T w="semibold" style={{ fontSize: 12, color: C.ink }} numberOfLines={1}>🏦 {partnerName}</T> : null}
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
      <ApplicantDetails r={r} />
      {r.docs && Object.keys(r.docs).length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {Object.keys(r.docs).sort((a, b) => docOrder(a) - docOrder(b)).map((k) => (
            <DocChip key={k} requestId={r.id} docKey={k} />
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

  // Зөвхөн өөр түнш сонгогдох эсвэл хадгалагдсан үед (updated_at өөрчлөгдөхөд) формыг шинэчилнэ —
  // live шинэчлэлтээр шинэ объект ирэхэд бичиж буй утгыг арилгахгүй.
  const partnerRef = useRef(partner);
  partnerRef.current = partner;
  useEffect(() => {
    const p = partnerRef.current;
    setF(termsFrom(p));
    setDocs(p.required_docs ?? DEFAULT_REQUIRED_DOCS);
  }, [partner.id, partner.updated_at]);

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

/** Баримтыг нээнэ: loan_doc_open RPC эрхийг шалгаж, хэн нээснийг бүртгээд замыг буцаана → 2 минутын түр холбоос */
async function openDoc(requestId: string, key: string) {
  try {
    const { data: path, error } = await supabase.rpc("loan_doc_open", { p_request: requestId, p_key: key });
    if (error) throw error;
    if (!path || typeof path !== "string") throw new Error("Файл олдсонгүй");
    const { data, error: e2 } = await supabase.storage.from("loan-docs").createSignedUrl(path, 120);
    if (e2) throw e2;
    if (!data?.signedUrl) throw new Error("Файл олдсонгүй");
    await WebBrowser.openBrowserAsync(data.signedUrl, { toolbarColor: "#111317", controlsColor: "#F5B800" });
  } catch (e) {
    Alert.alert("Нээж чадсангүй", errMsg(e));
  }
}

function DocChip({ requestId, docKey }: { requestId: string; docKey: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${docLabel(docKey)} нээх`}
      disabled={busy}
      onPress={async () => { setBusy(true); await openDoc(requestId, docKey); setBusy(false); }}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.line2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, maxWidth: "100%", opacity: busy ? 0.5 : 1 }}
    >
      <Feather name={busy ? "loader" : "paperclip"} size={12} color={C.ink} />
      <T style={{ fontSize: 12, flexShrink: 1 }}>{docLabel(docKey)}</T>
    </Pressable>
  );
}

function eventText(e: LoanEvent) {
  switch (e.kind) {
    case "submitted": return "Хүсэлт илгээсэн";
    case "status": return `Төлөв: ${e.detail ? LOAN_STATUS[e.detail as LoanStatus]?.label ?? e.detail : "—"}`;
    case "doc_view": return `Баримт нээсэн: ${e.detail ? docLabel(e.detail) : "—"}`;
    case "cancelled": return "Цуцалсан";
    default: return e.detail ?? String(e.kind);
  }
}

/** Хүсэлтийн түүх (хэн, хэзээ, юу хийсэн) — зөвхөн админ, тухайн компанийн ажилтанд RLS зөвшөөрнө */
function History({ requestId, version }: { requestId: string; version: string }) {
  const [events, setEvents] = useState<LoanEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.from("loan_events").select("*").eq("request_id", requestId).order("created_at", { ascending: true }).then(({ data, error }) => {
      if (!alive) return;
      if (error) setErr(errMsg(error));
      else { setErr(null); setEvents((data ?? []) as LoanEvent[]); }
    });
    return () => { alive = false; };
  }, [requestId, version]);
  return (
    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
      <T w="semibold" style={{ fontSize: 13 }}>Түүх</T>
      {err ? <T style={{ fontSize: 12, color: C.danger }}>{err}</T>
        : !events ? <Skeleton style={{ height: 36, borderRadius: 8 }} />
        : events.length === 0 ? <T style={{ fontSize: 12, color: C.muted }}>Бүртгэл алга</T>
        : events.map((e) => (
          <View key={String(e.id)} style={{ flexDirection: "row", gap: 10 }}>
            <T style={{ fontSize: 12, color: C.muted, width: 80 }} numberOfLines={1}>{timeAgo(e.created_at)}</T>
            <T style={{ fontSize: 12, flex: 1 }}>
              <T w="semibold" style={{ fontSize: 12 }}>{e.actor_name || "Систем"}</T> — {eventText(e)}
            </T>
          </View>
        ))}
    </View>
  );
}

function ApplicantDetails({ r }: { r: LoanRequest }) {
  const [open, setOpen] = useState(false);
  const a = r.applicant ?? {};
  const hasApplicant = Object.keys(a).length > 0;
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
        <T w="semibold" style={{ fontSize: 13 }}>{hasApplicant ? "Анкет, түүх харах" : "Түүх харах"}</T>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.ink} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
          {hasApplicant && rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", gap: 10 }}>
              <T style={{ fontSize: 12, color: C.muted, width: 120 }}>{k}</T>
              <T w="medium" style={{ fontSize: 12, flex: 1 }}>{v}</T>
            </View>
          ))}
          <History requestId={r.id} version={r.updated_at} />
        </View>
      )}
    </View>
  );
}
