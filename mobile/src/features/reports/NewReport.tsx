import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C, F } from "@/lib/theme";
import { money, num } from "@/lib/format";
import type { ContractTerms } from "@shared/contract";
import { agentAmount, commissionAmount, commissionFor } from "@shared/commission";
import { digits, staffRpc } from "@/lib/staff";
import { Button, Field, Input, Skeleton, T, s } from "@/components/ui";
import type { AdOpt, AgentOpt } from "./types";

const ubToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());

export function NewReport({
  defaultAd,
  fallback,
  onClose,
  onSent,
}: {
  defaultAd?: string;
  fallback: ContractTerms;
  onClose: () => void;
  onSent: () => void;
}) {
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
    supabase
      .from("profiles")
      .select("id,full_name,agent_code")
      .eq("role", "agent")
      .eq("is_blocked", false)
      .order("full_name")
      .then(
        ({ data }) => setAgents((data ?? []) as AgentOpt[]),
        () => setAgents([]),
      );
  }, []);

  useEffect(() => {
    supabase
      .from("ads")
      .select(
        "id,brand,model,year_made,plate_number,price,approved_at,created_at,agent_id,contract:contracts!ads_contract_id_fkey(terms)",
      )
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
        if (d) {
          setPrice(num(d.price));
          setAgentId(d.agent_id ?? null);
        }
      });
  }, [defaultAd, fallback]);

  const ad = ads?.find((a) => a.id === adId) ?? null;
  const calc = useMemo(() => {
    if (!ad) return null;
    const sold = date === ubToday() ? new Date() : new Date(`${date}T12:00:00+08:00`);
    if (isNaN(sold.getTime())) return null;
    const c = commissionFor(ad.terms, ad.approved_at ?? ad.created_at, sold);
    const amount = commissionAmount(Number(digits(price)) || 0, c.percent);
    return {
      days: c.days,
      pct: c.percent,
      amount,
      agent: agentId ? agentAmount(amount, Number(settings.agent_share ?? 50)) : 0,
    };
  }, [ad, date, price, agentId, settings.agent_share]);

  async function send() {
    if (!ad) return Alert.alert("Зар сонгоно уу");
    const p = Number(digits(price));
    if (!p) return Alert.alert("Зарагдсан үнэ оруулна уу");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert("Огноо буруу", "Жишээ: 2026-10-09");
    setBusy(true);
    const soldAt = date === ubToday() ? new Date().toISOString() : new Date(`${date}T12:00:00+08:00`).toISOString();
    const r = await staffRpc<string>("submit_sale_report", {
      p_ad: ad.id,
      p_price: p,
      p_sold_at: soldAt,
      p_buyer_name: buyer || null,
      p_buyer_phone: buyerPhone || null,
      p_note: note || null,
      p_agent: agentId,
    });
    // Админ өөрөө бүртгэсэн тайланг шууд батална (зар зарагдсан болж, агентын хувь бодогдоно)
    const ok =
      r.ok && r.data
        ? (await staffRpc("review_sale_report", { p_id: r.data, p_approve: true, p_note: null })).ok
        : false;
    setBusy(false);
    if (r.ok) {
      Alert.alert(
        ok ? "Батлагдлаа" : "Хадгалагдлаа",
        ok ? "Зар зарагдсан болж, эзэнд нь мэдэгдэл очлоо." : "Тайлан хадгалагдсан, «Хүлээгдэж буй»-гаас батална уу.",
      );
      onSent();
    }
  }

  const shown = (ads ?? [])
    .filter(
      (a) => !q.trim() || `${a.brand} ${a.model} ${a.plate_number}`.toLowerCase().includes(q.trim().toLowerCase()),
    )
    .slice(0, 30);

  return (
    <View style={s.section}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T w="bold" style={s.h2}>
          Зарагдсан тайлан
        </T>
        <Pressable onPress={onClose} hitSlop={8}>
          <Feather name="x" size={20} color={C.muted} />
        </Pressable>
      </View>
      {!ad ? (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 13, color: C.muted }}>Аль зар зарагдсан бэ?</T>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: C.paper,
              borderRadius: 10,
              paddingHorizontal: 10,
              height: 42,
            }}
          >
            <Feather name="search" size={16} color={C.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Марк, загвар, дугаар"
              placeholderTextColor="#9AA0A9"
              style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0 }}
            />
          </View>
          {ads === null ? (
            <Skeleton style={{ height: 60, borderRadius: 10 }} />
          ) : shown.length === 0 ? (
            <T style={{ color: C.muted, fontSize: 13 }}>Идэвхтэй зар олдсонгүй</T>
          ) : null}
          {shown.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setAdId(a.id);
                setPrice(num(a.price));
                setAgentId(a.agent_id ?? null);
              }}
              style={({ pressed }) => ({
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: C.line,
                backgroundColor: pressed ? C.paper : C.card,
              })}
            >
              <T w="semibold" style={{ fontSize: 14 }}>
                {a.brand} {a.model} · {a.year_made}
              </T>
              <T style={{ fontSize: 12, color: C.muted }}>
                {a.plate_number} · {money(a.price)}
              </T>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => setAdId(null)}
            style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: C.paper,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <T w="semibold" style={{ fontSize: 14 }}>
                {ad.brand} {ad.model} · {ad.year_made}
              </T>
              <T style={{ fontSize: 12, color: C.muted }}>
                {ad.plate_number} · {money(ad.price)}
              </T>
            </View>
            <T style={{ fontSize: 12, color: C.muted, textDecorationLine: "underline" }}>Солих</T>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1.3 }}>
              <Field label="Зарагдсан үнэ (₮)">
                <Input
                  keyboardType="number-pad"
                  value={price}
                  onChangeText={(t) => {
                    const d = digits(t);
                    setPrice(d ? num(Number(d)) : "");
                  }}
                  mono
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Огноо">
                <Input value={date} onChangeText={setDate} placeholder="2026-10-09" mono maxLength={10} />
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Худалдан авагч">
                <Input value={buyer} onChangeText={setBuyer} placeholder="Заавал биш" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Утас">
                <Input
                  value={buyerPhone}
                  onChangeText={setBuyerPhone}
                  keyboardType="phone-pad"
                  placeholder="Заавал биш"
                />
              </Field>
            </View>
          </View>
          <Field label="Тэмдэглэл">
            <Input value={note} onChangeText={setNote} placeholder="Заавал биш" />
          </Field>
          {agents.length > 0 && (
            <Field label="Агент (зарыг авчирсан / зарсан)">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { id: null as string | null, label: "Агентгүй" },
                  ...agents.map((g) => ({
                    id: g.id as string | null,
                    label: `${g.full_name ?? "Агент"}${g.agent_code ? ` · ${g.agent_code}` : ""}`,
                  })),
                ].map((o) => {
                  const on = agentId === o.id;
                  return (
                    <Pressable
                      key={o.id ?? "none"}
                      onPress={() => setAgentId(o.id)}
                      style={{
                        height: 36,
                        paddingHorizontal: 12,
                        borderRadius: 18,
                        justifyContent: "center",
                        backgroundColor: on ? C.ink : C.card,
                        borderWidth: on ? 0 : 1,
                        borderColor: C.line2,
                      }}
                    >
                      <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>
                        {o.label}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>
          )}
          {calc && (
            <View
              style={{
                backgroundColor: C.ink,
                borderRadius: 12,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <T style={{ color: C.pale, fontSize: 12, flex: 1 }}>
                {calc.days} хоногт · шимтгэл{" "}
                <T w="bold" style={{ color: C.yellow, fontSize: 12 }}>
                  {calc.pct}%
                </T>
              </T>
              <T w="display" style={{ color: C.yellow, fontSize: 17 }}>
                {num(calc.amount)}₮
              </T>
            </View>
          )}
          {calc && calc.agent > 0 && (
            <T style={{ fontSize: 12, color: C.muted }}>
              Үүнээс агентад {num(calc.agent)}₮ ({Number(settings.agent_share ?? 50)}%)
            </T>
          )}
          <Button title="Бүртгэж батлах" icon="check" variant="yellow" loading={busy} onPress={send} />
        </View>
      )}
    </View>
  );
}
