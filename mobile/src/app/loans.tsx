import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Linking, Pressable, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { errMsg, timeAgo } from "@/lib/format";
import { confirm, staffRpc } from "@/lib/staff";
import { LOAN_STATUS, fmtNum, type LoanRequest } from "@/lib/loan";
import { Button, Skeleton, T, s } from "@/components/ui";

type Row = LoanRequest & { partner: { name: string; phone: string | null } | null };

/** Худалдан авагчийн илгээсэн лизингийн хүсэлтүүд */
export default function Loans() {
  const { session } = useAuth();
  const uid = session?.user.id ?? "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: e } = await supabase
        .from("loan_requests")
        .select("*, partner:leasing_partners(name,phone)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (e) throw e;
      setRows((data ?? []) as unknown as Row[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);
  useLiveSync(() => load(), ["loan_requests"]);

  async function cancel(r: Row) {
    const ok = await confirm("Хүсэлт цуцлах уу?", `${r.car} — ${r.partner?.name ?? "лизинг"}-д илгээсэн хүсэлт цуцлагдана.`, "Цуцлах", true);
    if (!ok) return;
    const res = await staffRpc("cancel_loan_request", { p_id: r.id });
    if (res.ok) {
      setRows((x) => x.map((y) => (y.id === r.id ? { ...y, status: "cancelled" } : y)));
      Alert.alert("Хүсэлт цуцлагдлаа");
      load();
    }
  }

  return (
    <FlatList
      data={loading ? [] : rows}
      keyExtractor={(r) => r.id}
      style={{ backgroundColor: C.paper }}
      contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.ink} />}
      ListHeaderComponent={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 6 }}>
          <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T w="display" style={{ fontSize: 20 }}>Лизингийн хүсэлт</T>
            <T style={{ fontSize: 12, color: C.muted }}>Илгээсэн хүсэлтийн явц, хариу</T>
          </View>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View style={{ gap: 10 }}>{[0, 1].map((i) => <Skeleton key={i} style={{ height: 140, borderRadius: 14 }} />)}</View>
        ) : error ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 30 }}>
            <T style={{ color: C.danger, textAlign: "center" }}>{error}</T>
            <Button small title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); load(); }} />
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 40 }}>
            <Feather name="percent" size={32} color={C.pale} />
            <T style={{ color: C.muted, textAlign: "center", lineHeight: 21 }}>Хүсэлт илгээгээгүй байна.{"\n"}Зарын дэлгэц дээрх “Лизингээр авах” хэсгээс илгээнэ.</T>
            <Button small title="Зарууд үзэх" onPress={() => router.replace("/")} />
          </View>
        )
      }
      renderItem={({ item: r }) => {
        const st = LOAN_STATUS[r.status];
        return (
          <View style={[s.card, { padding: 14, gap: 10 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Pressable style={{ flex: 1, gap: 2 }} disabled={!r.ad_id} onPress={() => r.ad_id && router.push(`/ads/${r.ad_id}`)}>
                <T w="bold" style={{ fontSize: 15 }}>{r.car}</T>
                <T style={{ fontSize: 12, color: C.muted }}>{r.partner?.name ?? "Лизинг"} · {timeAgo(r.created_at)}</T>
              </Pressable>
              <View style={{ backgroundColor: st.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
                <T w="semibold" style={{ fontSize: 11, color: st.fg }}>{st.label}</T>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Cell k="Урьдчилгаа" v={`${fmtNum(r.down_payment)}₮`} />
              <Cell k="Хугацаа" v={`${r.term_months} сар`} />
              <Cell k="Сарын төлбөр" v={`${fmtNum(r.monthly_payment)}₮`} strong />
            </View>
            {r.partner_note ? <T style={{ fontSize: 13, backgroundColor: C.paper, padding: 8, borderRadius: 8 }}>Лизинг: {r.partner_note}</T> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {r.partner?.phone ? (
                <Button small title={r.partner.phone} icon="phone" variant="ghost" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${r.partner!.phone!.replace(/\s/g, "")}`)} />
              ) : null}
              {r.status === "new" || r.status === "contacted" ? (
                <Button small title="Цуцлах" icon="x" variant="danger" style={{ flex: 1 }} onPress={() => cancel(r)} />
              ) : null}
            </View>
          </View>
        );
      }}
    />
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
