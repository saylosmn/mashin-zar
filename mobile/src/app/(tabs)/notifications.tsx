import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Switch, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg, timeAgo } from "@/lib/format";
import { Button, StateView, T } from "@/components/ui";
import type { Notification } from "@/lib/types";

const LABEL: Record<string, string> = { new_ad: "Шинэ зар", ad_approved: "Таны зар", ad_rejected: "Таны зар", offer: "Санал", sold: "Таны зар", staff_new_ad: "Менежерт", broadcast: "Зарлал", sale_report: "Тайлан", report_reviewed: "Тайлан", loan_request: "Лизинг", loan_update: "Лизинг" };

export default function Notifications() {
  const { profile, refreshProfile, settings, session } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cy = settings.cutoff_year;

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: e } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (e) throw e;
      setItems((data ?? []) as Notification[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const ch = supabase
      .channel("notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${session?.user.id}` }, (p) => setItems((x) => [p.new as Notification, ...x]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.user.id]);

  async function readAll() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    setItems((x) => x.map((n) => ({ ...n, read: true })));
  }

  async function setPref(patch: Record<string, unknown>) {
    await supabase.from("profiles").update(patch).eq("id", session?.user.id ?? "");
    refreshProfile();
  }

  if (error && !items.length) return <StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" icon="refresh-cw" onPress={load} /></StateView>;

  const catOpts: { v: "new" | "old" | null; l: string }[] = [{ v: null, l: "Бүгд" }, { v: "new", l: `${cy}+` }, { v: "old", l: `${cy}-аас өмнө` }];

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => String(n.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.ink} />}
      contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 8 }}
      ListHeaderComponent={
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T w="display" style={{ fontSize: 22 }}>Мэдэгдэл</T>
            {items.some((n) => !n.read) && <Pressable onPress={readAll} hitSlop={8}><T w="semibold" style={{ fontSize: 13 }}>Бүгдийг уншсан</T></Pressable>}
          </View>
          <View style={{ backgroundColor: C.ink, borderRadius: 14, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T w="semibold" style={{ color: C.paper, fontSize: 14 }}>Шинэ зарын мэдэгдэл</T>
              <Switch value={!!profile?.notify_new_ads} onValueChange={(v) => setPref({ notify_new_ads: v })} trackColor={{ true: C.yellow, false: C.inkLine }} thumbColor={C.paper} />
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <T style={{ color: C.pale, fontSize: 12 }}>Зөвхөн:</T>
              {catOpts.map((o) => {
                const on = (profile?.notify_category ?? null) === o.v;
                return (
                  <Pressable key={o.l} onPress={() => setPref({ notify_category: o.v })} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5, backgroundColor: on ? C.yellow : "transparent", borderWidth: on ? 0 : 1, borderColor: "#3A3F47" }}>
                    <T w={on ? "monoBold" : "body"} style={{ fontSize: 12, color: on ? C.ink : "#E2E4DF" }}>{o.l}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={loading ? null : (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 40 }}>
          <Feather name="bell" size={40} color={C.ink} />
          <T style={{ color: C.body }}>Одоогоор мэдэгдэл алга.</T>
        </View>
      )}
      renderItem={({ item: n }) => (
        <Pressable
          onPress={async () => {
            if (!n.read) { supabase.from("notifications").update({ read: true }).eq("id", n.id).then(() => {}); setItems((x) => x.map((y) => (y.id === n.id ? { ...y, read: true } : y))); }
            if (n.type === "sale_report" || n.type === "report_reviewed") router.push("/panel/reports");
            else if (n.type === "loan_request") router.push("/panel/leasing");
            else if (n.type === "loan_update") router.push("/loans");
            else if (n.ad_id) router.push(n.type === "staff_new_ad" && (profile?.role === "manager" || profile?.role === "admin") ? `/panel/ad/${n.ad_id}` : `/ads/${n.ad_id}`);
          }}
          style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, backgroundColor: n.read ? "transparent" : C.card, borderWidth: n.read ? 0 : 1, borderColor: C.line }}
        >
          <View style={{ width: 52, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: n.type === "ad_approved" ? C.activeBg : n.type === "offer" ? C.pendingBg : C.card, borderWidth: n.type === "ad_approved" || n.type === "offer" ? 0 : 1, borderColor: C.line }}>
            <Feather name={n.type === "ad_approved" ? "check" : n.type === "offer" ? "dollar-sign" : n.type === "ad_rejected" ? "x" : "bell"} size={22} color={n.type === "ad_approved" ? C.activeFg : n.type === "offer" ? C.pendingFg : C.ink} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <T w="bold" style={{ fontSize: 12, color: C.pendingFg }}>{LABEL[n.type] ?? "Мэдэгдэл"}</T>
              <T style={{ fontSize: 12, color: C.muted }}>{timeAgo(n.created_at)}</T>
            </View>
            <T w="semibold" style={{ fontSize: 14 }}>{n.title}</T>
            {n.body ? <T style={{ fontSize: 13, color: C.body }}>{n.body}</T> : null}
          </View>
          {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.dot, alignSelf: "center" }} />}
        </Pressable>
      )}
    />
  );
}
