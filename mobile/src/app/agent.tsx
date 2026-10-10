import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Share, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg, money } from "@/lib/format";
import { WEB_URL } from "@/lib/staff";
import { Button, Skeleton, StateView, StatusBadge, T, s } from "@/components/ui";
import type { AdStatus } from "@/lib/types";

type Report = {
  id: string; status: "pending" | "approved" | "rejected"; sold_price: number; sold_at: string;
  agent_amount: number | null; agent_paid_at: string | null; ad: { brand: string; model: string; year_made: number } | null;
};
type AgentAd = { id: string; brand: string; model: string; year_made: number; price: number; status: AdStatus };

export default function AgentScreen() {
  const { profile, settings } = useAuth();
  const [ads, setAds] = useState<AgentAd[] | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const uid = profile?.id;

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setError(null);
      const [a, r] = await Promise.all([
        supabase.from("ads").select("id,brand,model,year_made,price,status").eq("agent_id", uid).order("created_at", { ascending: false }).limit(200),
        supabase.from("sale_reports").select("id,status,sold_price,sold_at,agent_amount,agent_paid_at,ad:ads(brand,model,year_made)").eq("agent_id", uid).order("created_at", { ascending: false }).limit(200),
      ]);
      if (a.error) throw a.error;
      if (r.error) throw r.error;
      setAds((a.data ?? []) as AgentAd[]);
      setReports((r.data ?? []) as unknown as Report[]);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [uid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = (
    <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
      <Feather name="chevron-left" size={22} color={C.ink} />
    </Pressable>
  );

  if (profile && profile.role !== "agent" && profile.role !== "admin")
    return <StateView icon="lock" title="Агентын эрхгүй" text="Энэ хэсэг зөвхөн агентуудад."><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (error) return <StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" onPress={load} /></StateView>;

  const code = profile?.agent_code;
  const link = code ? `${(settings.site_url || WEB_URL).replace(/\/+$/, "")}/?ref=${code}` : null;
  const approved = reports.filter((r) => r.status === "approved");
  const earned = approved.reduce((t, r) => t + (r.agent_amount ?? 0), 0);
  const paid = approved.filter((r) => r.agent_paid_at).reduce((t, r) => t + (r.agent_amount ?? 0), 0);
  const waiting = reports.filter((r) => r.status === "pending").reduce((t, r) => t + (r.agent_amount ?? 0), 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {back}
        <T w="display" style={{ fontSize: 20 }}>Агентын самбар</T>
      </View>

      <View style={{ backgroundColor: C.ink, borderRadius: 18, padding: 18, gap: 10 }}>
        <T style={{ color: C.pale, fontSize: 13 }}>Таны код</T>
        <T w="monoBold" style={{ color: C.yellow, fontSize: 30, letterSpacing: 4 }}>{code ?? "—"}</T>
        {link ? (
          <>
            <T w="mono" style={{ color: "#C9CDD3", fontSize: 12 }}>{link}</T>
            <Button small variant="yellow" icon="share-2" title="Холбоос хуваалцах" onPress={() => Share.share({ message: `Машинаа «Машин зар»-аар зараарай: ${link}\nАгентын код: ${code}` })} />
            <T style={{ color: C.pale, fontSize: 12, lineHeight: 18 }}>Машинаа зарах хүнд холбоосоо илгээх эсвэл зар оруулахдаа «Агентын код» талбарт кодоо бичүүлнэ.</T>
          </>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          ["Авчирсан зар", ads ? String(ads.length) : "…"],
          ["Нийт олсон", money(earned)],
          ["Хүлээн авсан", money(paid)],
          ["Төлөгдөх", money(earned - paid + waiting)],
        ].map(([k, v], i) => (
          <View key={k} style={[s.card, { flexBasis: "47%", flexGrow: 1, padding: 14, gap: 4, backgroundColor: i === 3 ? C.ink : C.card }]}>
            <T style={{ fontSize: 12, color: i === 3 ? "#C9CDD3" : C.muted }}>{k}</T>
            <T w="display" style={{ fontSize: 18, color: i === 3 ? C.yellow : C.ink }}>{v}</T>
          </View>
        ))}
      </View>

      <T w="bold" style={s.h2}>Борлуулалт</T>
      {reports.length === 0 ? (
        <T style={{ color: C.muted, textAlign: "center", paddingVertical: 16 }}>Одоогоор борлуулалт алга.</T>
      ) : reports.map((r) => (
        <View key={r.id} style={[s.card, { padding: 14, gap: 6 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <T w="semibold" style={{ flex: 1 }}>{r.ad ? `${r.ad.brand} ${r.ad.model} · ${r.ad.year_made}` : "Устгагдсан зар"}</T>
            <T w="monoBold">{money(r.agent_amount ?? 0)}</T>
          </View>
          <T style={{ fontSize: 12, color: r.status === "rejected" ? C.danger : r.agent_paid_at ? C.activeFg : C.pendingFg }}>
            {r.status === "pending" ? "Админ шалгаж байна" : r.status === "rejected" ? "Буцаагдсан" : r.agent_paid_at ? "Төлсөн" : "Төлөгдөөгүй"} · зарагдсан үнэ {money(r.sold_price)}
          </T>
        </View>
      ))}

      <T w="bold" style={s.h2}>Таны кодоор орсон зарууд</T>
      {!ads ? <Skeleton style={{ height: 80 }} /> : ads.length === 0 ? (
        <T style={{ color: C.muted, textAlign: "center", paddingVertical: 16 }}>Одоогоор зар алга. Холбоосоо хуваалцаж эхлээрэй.</T>
      ) : ads.map((a) => (
        <Pressable key={a.id} onPress={() => router.push(`/ads/${a.id}`)} style={[s.card, { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <T w="semibold">{a.brand} {a.model} · {a.year_made}</T>
            <T style={{ fontSize: 13, color: C.muted }}>{money(a.price)}</T>
          </View>
          <StatusBadge s={a.status} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
