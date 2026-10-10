import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C, F } from "@/lib/theme";
import { errMsg, money, timeAgo } from "@/lib/format";
import { termsFrom, type ContractTerms } from "@/lib/contract";
import { agentAmount, commissionAmount, commissionFor } from "@/lib/commission";
import { confirm, digits, isAdmin, isStaff, openContract, staffRpc } from "@/lib/staff";
import { Button, Field, Input, Skeleton, StateView, T, s } from "@/components/ui";

type Report = {
  id: string; ad_id: string; sold_price: number; sold_at: string; buyer_name: string | null; buyer_phone: string | null; note: string | null;
  days_on_market: number; commission_percent: number; commission_amount: number; status: "pending" | "approved" | "rejected";
  admin_note: string | null; created_at: string;
  ad: { id: string; brand: string; model: string; year_made: number; plate_number: string; contract_id: string | null } | null;
  manager: { full_name: string | null; email: string | null } | null;
  agent_id?: string | null; agent_amount?: number | null; agent_share?: number | null; agent_paid_at?: string | null;
  agent?: { full_name: string | null; agent_code: string | null } | null;
};
type AdOpt = { id: string; brand: string; model: string; year_made: number; plate_number: string; price: number; approved_at: string | null; created_at: string; terms: ContractTerms; agent_id?: string | null };
type AgentOpt = { id: string; full_name: string | null; agent_code: string | null };

const SELECT = "*, ad:ads(id,brand,model,year_made,plate_number,contract_id), manager:profiles!sale_reports_manager_id_fkey(full_name,email), agent:profiles!sale_reports_agent_id_fkey(full_name,agent_code)";
const ST = {
  pending: { label: "Хүлээгдэж буй", bg: C.pendingBg, fg: C.pendingFg },
  approved: { label: "Батлагдсан", bg: C.activeBg, fg: C.activeFg },
  rejected: { label: "Буцаагдсан", bg: C.dangerBg, fg: "#9B1C1C" },
} as const;
type Filter = "pending" | "approved" | "rejected" | "all";

const ubToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function Reports() {
  const params = useLocalSearchParams<{ ad?: string }>();
  const { profile, settings } = useAuth();
  const admin = isAdmin(profile);
  const [rows, setRows] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Filter>(admin ? "pending" : "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(!!params.ad);
  const fallback = useMemo(() => termsFrom(settings).terms, [settings]);

  const load = useCallback(async () => {
    try {
      setError(null);
      let q = supabase.from("sale_reports").select(SELECT).order("created_at", { ascending: false }).limit(150);
      if (!admin) q = q.eq("manager_id", profile?.id ?? "");
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error: e } = await q;
      if (e) throw e;
      setRows((data ?? []) as unknown as Report[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [admin, filter, profile?.id]);

  useEffect(() => { load(); }, [load]);
  useLiveSync(() => load(), ["sale_reports", "ads"]);

  if (!isStaff(profile)) return <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг зөвхөн менежер, админд нээлттэй."><Button title="Буцах" onPress={() => router.back()} /></StateView>;

  async function review(r: Report, approve: boolean, note: string) {
    const ok = await confirm(
      approve ? "Тайлан батлах уу?" : "Тайлан буцаах уу?",
      approve ? `${r.ad?.brand ?? ""} ${r.ad?.model ?? ""} “зарагдсан” болж, эзэнд нь мэдэгдэл очно.` : "Менежерт буцаагдсан тухай мэдэгдэл очно.",
      approve ? "Батлах" : "Буцаах",
      !approve,
    );
    if (!ok) return;
    const res = await staffRpc("review_sale_report", { p_id: r.id, p_approve: approve, p_note: note.trim() || null });
    if (res.ok) load();
  }

  async function markPaid(r: Report, paid: boolean) {
    const ok = await confirm(paid ? "Агентад төлсөн үү?" : "Төлөөгүй болгох уу?", paid ? `${money(r.agent_amount ?? 0)} шилжүүлсэн гэж тэмдэглэнэ.` : "", "Тийм");
    if (!ok) return;
    const res = await staffRpc("set_agent_paid", { p_id: r.id, p_paid: paid });
    if (res.ok) load();
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "pending", label: "Хүлээгдэж буй" },
    { key: "approved", label: "Батлагдсан" },
    { key: "rejected", label: "Буцаагдсан" },
    { key: "all", label: "Бүгд" },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
                <Feather name="chevron-left" size={22} color={C.ink} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <T w="display" style={{ fontSize: 20 }}>{admin ? "Тайлангууд" : "Тайлан"}</T>
                <T style={{ fontSize: 12, color: C.muted }}>{admin ? "Менежерүүдийн борлуулалтын тайлан" : "Зарсан машинаа админд тайлагнах"}</T>
              </View>
              {!formOpen && <Button small title="Шинэ" icon="plus" variant="yellow" onPress={() => setFormOpen(true)} />}
            </View>
            {formOpen && <NewReport defaultAd={params.ad} fallback={fallback} onClose={() => setFormOpen(false)} onSent={() => { setFormOpen(false); setFilter(admin ? "pending" : "all"); load(); }} />}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {filters.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable key={f.key} onPress={() => { if (on) return; setLoading(true); setFilter(f.key); }} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}>
                    <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>{f.label}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>{[0, 1].map((i) => <Skeleton key={i} style={{ height: 150, borderRadius: 14 }} />)}</View>
          ) : error ? (
            <T style={{ color: C.danger, textAlign: "center", paddingVertical: 24 }}>{error}</T>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 30 }}>
              <Feather name="file-text" size={30} color={C.pale} />
              <T style={{ color: C.muted }}>Тайлан алга</T>
            </View>
          )
        }
        renderItem={({ item }) => <ReportCard r={item} admin={admin} onReview={review} onPaid={markPaid} />}
      />
    </KeyboardAvoidingView>
  );
}

function ReportCard({ r, admin, onReview, onPaid }: { r: Report; admin: boolean; onReview: (r: Report, approve: boolean, note: string) => void; onPaid: (r: Report, paid: boolean) => void }) {
  const [note, setNote] = useState("");
  const st = ST[r.status];
  return (
    <View style={[s.card, { padding: 14, gap: 10 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T w="bold" style={{ fontSize: 15 }}>{r.ad ? `${r.ad.brand} ${r.ad.model} · ${r.ad.year_made}` : "Устгагдсан зар"}</T>
          <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{r.ad?.plate_number ?? ""} · {r.manager?.full_name ?? r.manager?.email ?? "Менежер"} · {timeAgo(r.created_at)}</T>
        </View>
        <View style={{ backgroundColor: st.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
          <T w="semibold" style={{ fontSize: 11, color: st.fg }}>{st.label}</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Cell k="Зарагдсан үнэ" v={money(r.sold_price)} />
        <Cell k="Хугацаа" v={`${r.days_on_market} хоног`} />
        <Cell k={`Шимтгэл ${Number(r.commission_percent)}%`} v={money(r.commission_amount)} strong />
      </View>
      {r.buyer_name || r.buyer_phone || r.note ? (
        <T style={{ fontSize: 13, color: C.body, lineHeight: 19 }}>
          {r.buyer_name || r.buyer_phone ? `Худалдан авагч: ${[r.buyer_name, r.buyer_phone].filter(Boolean).join(", ")}. ` : ""}{r.note ?? ""}
        </T>
      ) : null}
      {r.agent_id ? (
        <View style={{ backgroundColor: C.paper, borderRadius: 8, padding: 8, gap: 6 }}>
          <T style={{ fontSize: 13 }}>
            Агент: <T w="semibold" style={{ fontSize: 13 }}>{r.agent?.full_name ?? "—"}</T>{r.agent?.agent_code ? ` · ${r.agent.agent_code}` : ""} · {money(r.agent_amount ?? 0)}
            {r.status === "approved" ? (r.agent_paid_at ? " · Төлсөн" : " · Төлөөгүй") : ""}
          </T>
          {admin && r.status === "approved" ? (
            <Button small variant={r.agent_paid_at ? "ghost" : "ink"} title={r.agent_paid_at ? "Төлөөгүй болгох" : "Агентад төлсөн гэж тэмдэглэх"} onPress={() => onPaid(r, !r.agent_paid_at)} />
          ) : null}
        </View>
      ) : null}
      {r.admin_note ? <T style={{ fontSize: 13, backgroundColor: C.paper, padding: 8, borderRadius: 8 }}>Админ: {r.admin_note}</T> : null}
      {r.ad?.contract_id ? <Button small title="Гэрээ (PDF)" icon="file-text" variant="ghost" onPress={() => openContract(r.ad!.contract_id!)} /> : null}
      {admin && r.status === "pending" && (
        <View style={{ gap: 8 }}>
          <Input value={note} onChangeText={setNote} placeholder="Тэмдэглэл (заавал биш)" style={{ height: 44 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button small title="Буцаах" icon="x" variant="danger" style={{ flex: 1 }} onPress={() => onReview(r, false, note)} />
            <Button small title="Батлах" icon="check" variant="yellow" style={{ flex: 1 }} onPress={() => onReview(r, true, note)} />
          </View>
        </View>
      )}
    </View>
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

function NewReport({ defaultAd, fallback, onClose, onSent }: { defaultAd?: string; fallback: ContractTerms; onClose: () => void; onSent: () => void }) {
  const [ads, setAds] = useState<AdOpt[] | null>(null);
  const [q, setQ] = useState("");
  const [adId, setAdId] = useState<string | null>(defaultAd ?? null);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(ubToday());
  const [buyer, setBuyer] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const { settings } = useAuth();

  useEffect(() => {
    supabase.from("profiles").select("id,full_name,agent_code").eq("role", "agent").eq("is_blocked", false).order("full_name")
      .then(({ data }) => setAgents((data ?? []) as AgentOpt[]), () => setAgents([]));
  }, []);

  useEffect(() => {
    supabase
      .from("ads")
      .select("id,brand,model,year_made,plate_number,price,approved_at,created_at,agent_id,contract:contracts!ads_contract_id_fkey(terms)")
      .eq("status", "active")
      .order("approved_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        const list = (data ?? []).map((a) => {
          const c = a.contract as unknown as { terms: ContractTerms } | { terms: ContractTerms }[] | null;
          return { ...a, terms: (Array.isArray(c) ? c[0]?.terms : c?.terms) ?? fallback } as AdOpt;
        });
        setAds(list);
        const d = list.find((x) => x.id === defaultAd);
        if (d) { setPrice(fmt(d.price)); setAgentId(d.agent_id ?? null); }
      });
  }, [defaultAd, fallback]);

  const ad = ads?.find((a) => a.id === adId) ?? null;
  const calc = useMemo(() => {
    if (!ad) return null;
    const sold = date === ubToday() ? new Date() : new Date(`${date}T12:00:00+08:00`);
    if (isNaN(sold.getTime())) return null;
    const c = commissionFor(ad.terms, ad.approved_at ?? ad.created_at, sold);
    const amount = commissionAmount(Number(digits(price)) || 0, c.percent);
    return { days: c.days, pct: c.percent, amount, agent: agentId ? agentAmount(amount, Number(settings.agent_share ?? 50)) : 0 };
  }, [ad, date, price, agentId, settings.agent_share]);

  async function send() {
    if (!ad) return Alert.alert("Зар сонгоно уу");
    const p = Number(digits(price));
    if (!p) return Alert.alert("Зарагдсан үнэ оруулна уу");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert("Огноо буруу", "Жишээ: 2026-10-09");
    setBusy(true);
    const soldAt = date === ubToday() ? new Date().toISOString() : new Date(`${date}T12:00:00+08:00`).toISOString();
    const r = await staffRpc("submit_sale_report", { p_ad: ad.id, p_price: p, p_sold_at: soldAt, p_buyer_name: buyer || null, p_buyer_phone: buyerPhone || null, p_note: note || null, p_agent: agentId });
    setBusy(false);
    if (r.ok) {
      Alert.alert("Илгээгдлээ", "Тайлан админд очлоо.");
      onSent();
    }
  }

  const shown = (ads ?? []).filter((a) => !q.trim() || `${a.brand} ${a.model} ${a.plate_number}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);

  return (
    <View style={s.section}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T w="bold" style={s.h2}>Зарагдсан тайлан</T>
        <Pressable onPress={onClose} hitSlop={8}><Feather name="x" size={20} color={C.muted} /></Pressable>
      </View>
      {!ad ? (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 13, color: C.muted }}>Аль зар зарагдсан бэ?</T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.paper, borderRadius: 10, paddingHorizontal: 10, height: 42 }}>
            <Feather name="search" size={16} color={C.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Марк, загвар, дугаар" placeholderTextColor="#9AA0A9" style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0 }} />
          </View>
          {ads === null ? <Skeleton style={{ height: 60, borderRadius: 10 }} /> : shown.length === 0 ? <T style={{ color: C.muted, fontSize: 13 }}>Идэвхтэй зар олдсонгүй</T> : null}
          {shown.map((a) => (
            <Pressable key={a.id} onPress={() => { setAdId(a.id); setPrice(fmt(a.price)); setAgentId(a.agent_id ?? null); }} style={({ pressed }) => ({ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.paper : C.card })}>
              <T w="semibold" style={{ fontSize: 14 }}>{a.brand} {a.model} · {a.year_made}</T>
              <T style={{ fontSize: 12, color: C.muted }}>{a.plate_number} · {money(a.price)}</T>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Pressable onPress={() => setAdId(null)} style={{ padding: 10, borderRadius: 10, backgroundColor: C.paper, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T w="semibold" style={{ fontSize: 14 }}>{ad.brand} {ad.model} · {ad.year_made}</T>
              <T style={{ fontSize: 12, color: C.muted }}>{ad.plate_number} · {money(ad.price)}</T>
            </View>
            <T style={{ fontSize: 12, color: C.muted, textDecorationLine: "underline" }}>Солих</T>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1.3 }}>
              <Field label="Зарагдсан үнэ (₮)"><Input keyboardType="number-pad" value={price} onChangeText={(t) => { const d = digits(t); setPrice(d ? fmt(Number(d)) : ""); }} mono /></Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Огноо"><Input value={date} onChangeText={setDate} placeholder="2026-10-09" mono maxLength={10} /></Field>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Худалдан авагч"><Input value={buyer} onChangeText={setBuyer} placeholder="Заавал биш" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Утас"><Input value={buyerPhone} onChangeText={setBuyerPhone} keyboardType="phone-pad" placeholder="Заавал биш" /></Field></View>
          </View>
          <Field label="Тэмдэглэл"><Input value={note} onChangeText={setNote} placeholder="Заавал биш" /></Field>
          {agents.length > 0 && (
            <Field label="Агент (зарыг авчирсан / зарсан)">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[{ id: null as string | null, label: "Агентгүй" }, ...agents.map((g) => ({ id: g.id as string | null, label: `${g.full_name ?? "Агент"}${g.agent_code ? ` · ${g.agent_code}` : ""}` }))].map((o) => {
                  const on = agentId === o.id;
                  return (
                    <Pressable key={o.id ?? "none"} onPress={() => setAgentId(o.id)} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center", backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2 }}>
                      <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>{o.label}</T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>
          )}
          {calc && (
            <View style={{ backgroundColor: C.ink, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <T style={{ color: C.pale, fontSize: 12, flex: 1 }}>{calc.days} хоногт · шимтгэл <T w="bold" style={{ color: C.yellow, fontSize: 12 }}>{calc.pct}%</T></T>
              <T w="display" style={{ color: C.yellow, fontSize: 17 }}>{fmt(calc.amount)}₮</T>
            </View>
          )}
          {calc && calc.agent > 0 && (
            <T style={{ fontSize: 12, color: C.muted }}>Үүнээс агентад {fmt(calc.agent)}₮ ({Number(settings.agent_share ?? 50)}%)</T>
          )}
          <Button title="Админд илгээх" icon="send" variant="yellow" loading={busy} onPress={send} />
        </View>
      )}
    </View>
  );
}
