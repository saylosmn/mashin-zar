import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C, F } from "@/lib/theme";
import { errMsg, money, timeAgo } from "@/lib/format";
import { STAFF_AD_SELECT, isAdmin, isStaff, type StaffAd } from "@/lib/staff";
import { staffAdCache } from "@/lib/cache";
import { LeasingPanel } from "@/components/LeasingPanel";
import { Button, Photo, Skeleton, StateView, StatusBadge, T, s } from "@/components/ui";
import type { AdStatus } from "@/lib/types";

type Stats = { pending: number; active: number; soldMonth: number; soldMonthSum: number; users: number; offers: number; flags: number };
const EMPTY: Stats = { pending: 0, active: 0, soldMonth: 0, soldMonthSum: 0, users: 0, offers: 0, flags: 0 };

const FILTERS: { key: AdStatus; label: string }[] = [
  { key: "pending", label: "Хүлээгдэж буй" },
  { key: "active", label: "Идэвхтэй" },
  { key: "sold", label: "Зарагдсан" },
  { key: "rejected", label: "Татгалзсан" },
];

const head = { count: "exact" as const, head: true };

export default function PanelTab() {
  const { profile } = useAuth();
  // Лизингийн түншийн ажилтанд өөрийн панел
  if (profile?.role === "leasing") return <LeasingPanel />;
  return <Panel />;
}

function Panel() {
  const { profile } = useAuth();
  const admin = isAdmin(profile);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [status, setStatus] = useState<AdStatus>("pending");
  const [q, setQ] = useState("");
  const [ads, setAds] = useState<StaffAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qRef = useRef(q);
  qRef.current = q;

  const loadStats = useCallback(async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [p, a, sold, u, o, f] = await Promise.all([
      supabase.from("ads").select("id", head).eq("status", "pending"),
      supabase.from("ads").select("id", head).eq("status", "active"),
      supabase.from("ads").select("sold_price,price").eq("status", "sold").gte("sold_at", monthStart),
      supabase.from("profiles").select("id", head),
      supabase.from("ads").select("id", head).not("offer_sent_at", "is", null),
      supabase.from("ad_flags").select("id", head).eq("status", "open"),
    ]);
    const soldRows = (sold.data ?? []) as { sold_price: number | null; price: number }[];
    setStats({
      pending: p.count ?? 0,
      active: a.count ?? 0,
      soldMonth: soldRows.length,
      soldMonthSum: soldRows.reduce((t, r) => t + (r.sold_price ?? r.price ?? 0), 0),
      users: u.count ?? 0,
      offers: o.count ?? 0,
      flags: f.count ?? 0,
    });
  }, []);

  const loadAds = useCallback(async () => {
    try {
      setError(null);
      let query = supabase.from("ads").select(STAFF_AD_SELECT).eq("status", status);
      const term = qRef.current.trim().replace(/[,()%]/g, " ").trim();
      if (term) query = query.or(`brand.ilike.%${term}%,model.ilike.%${term}%,plate_number.ilike.%${term}%,phone.ilike.%${term}%`);
      const order = status === "sold" ? "sold_at" : "created_at";
      const { data, error: e } = await query.order(order, { ascending: status === "pending" }).limit(100);
      if (e) throw e;
      setAds((data ?? []) as StaffAd[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  const loadAll = useCallback(() => {
    loadStats().catch(() => {});
    return loadAds();
  }, [loadStats, loadAds]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));
  useEffect(() => {
    const t = setTimeout(() => loadAds(), 350);
    return () => clearTimeout(t);
  }, [q, loadAds]);
  useLiveSync(() => loadAll(), ["ads", "profiles", "ad_flags"]);

  if (!isStaff(profile))
    return (
      <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг зөвхөн менежер, админд нээлттэй.">
        <Button title="Зарууд руу" onPress={() => router.replace("/")} />
      </StateView>
    );

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ gap: 2 }}>
          <T w="display" style={{ fontSize: 22 }}>Удирдлага</T>
          <T style={{ fontSize: 13, color: C.muted }}>{admin ? "Админ" : "Менежер"} · {profile?.full_name?.split(" ")[0] ?? ""}</T>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <IconBtn icon="file-text" label="Тайлан" onPress={() => router.push("/panel/reports")} />
          {admin && <IconBtn icon="percent" label="Лизинг" onPress={() => router.push("/panel/leasing")} />}
          {!admin && <IconBtn icon="users" label="Хэрэглэгчид" onPress={() => router.push("/panel/users")} />}
          {admin && <IconBtn icon="bell" label="Мэдэгдэл" onPress={() => router.push("/panel/broadcasts")} />}
          {admin && <IconBtn icon="settings" label="Тохиргоо" onPress={() => router.push("/panel/settings")} />}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Kpi dark label="Хүлээгдэж буй" value={stats.pending} onPress={() => setStatus("pending")} />
        <Kpi label="Идэвхтэй зар" value={stats.active} onPress={() => setStatus("active")} />
        <Kpi label="Зарагдсан (энэ сар)" value={stats.soldMonth} sub={stats.soldMonthSum ? money(stats.soldMonthSum) : undefined} onPress={() => setStatus("sold")} />
        {admin ? (
          <Kpi label="Хэрэглэгч" value={stats.users} onPress={() => router.push("/panel/users")} />
        ) : (
          <Kpi label="Илгээсэн санал" value={stats.offers} />
        )}
        <Kpi label="Гомдол" value={stats.flags} sub={stats.flags ? "Шийдвэрлэх →" : "Алга"} onPress={() => router.push("/panel/flags")} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, borderRadius: 12, paddingHorizontal: 12, height: 46 }}>
        <Feather name="search" size={18} color={C.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Марк, загвар, улсын дугаар, утас"
          placeholderTextColor="#9AA0A9"
          style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0 }}
          returnKeyType="search"
        />
        {q ? (
          <Pressable accessibilityLabel="Цэвэрлэх" onPress={() => setQ("")} hitSlop={10}>
            <Feather name="x" size={18} color={C.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {FILTERS.map((f) => {
          const on = f.key === status;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => { if (on) return; setLoading(true); setStatus(f.key); }}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}
            >
              <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>
                {f.label}{f.key === "pending" && stats.pending ? ` ${stats.pending}` : ""}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      data={loading ? [] : ads}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 10, paddingBottom: 40 }}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={C.ink} />}
      ListEmptyComponent={
        loading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 92, borderRadius: 14 }} />)}
          </View>
        ) : error ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 30 }}>
            <T style={{ color: C.danger, textAlign: "center" }}>{error}</T>
            <Button small title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); loadAll(); }} />
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 8, paddingVertical: 40 }}>
            <Feather name="inbox" size={34} color={C.pale} />
            <T style={{ color: C.muted }}>{q ? "Хайлтад тохирох зар алга" : "Энд зар алга байна"}</T>
          </View>
        )
      }
      renderItem={({ item: a }) => <AdRow a={a} />}
    />
  );
}

function AdRow({ a }: { a: StaffAd }) {
  return (
    <Pressable onPress={() => { staffAdCache.set(a.id, a); router.push(`/panel/ad/${a.id}`); }} style={({ pressed }) => [s.card, { padding: 12, flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 }]}>
      <Photo path={a.photos[0]} style={{ width: 76, height: 76, borderRadius: 10 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <T w="semibold" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{a.brand} {a.model} · {a.year_made}</T>
        </View>
        <T w="display" style={{ fontSize: 15 }}>{money(a.price)}</T>
        <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
          {a.owner?.full_name ?? "Нэргүй"} · {a.phone} · {timeAgo(a.status === "sold" && a.sold_at ? a.sold_at : a.created_at)}
        </T>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {a.status !== "pending" && <StatusBadge s={a.status} />}
          {a.contacted_at && <Tag text="Холбогдсон" />}
          {a.offer_amount != null && <Tag text={`Санал ${money(a.offer_amount)}`} strong />}
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={C.pale} style={{ alignSelf: "center" }} />
    </Pressable>
  );
}

function Tag({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <View style={{ backgroundColor: strong ? C.pendingBg : C.soft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <T w="semibold" style={{ fontSize: 11, color: strong ? C.pendingFg : C.body }}>{text}</T>
    </View>
  );
}

function Kpi({ label, value, sub, dark, onPress }: { label: string; value: number; sub?: string; dark?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: "45%",
        backgroundColor: dark ? C.ink : C.card,
        borderWidth: dark ? 0 : 1,
        borderColor: C.line,
        borderRadius: 14,
        padding: 14,
        gap: 4,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <T style={{ fontSize: 12, color: dark ? C.pale : C.muted }} numberOfLines={1}>{label}</T>
      <T w="display" style={{ fontSize: 24, color: dark ? C.yellow : C.ink }}>{value}</T>
      {sub ? <T style={{ fontSize: 11, color: dark ? C.pale : C.muted }} numberOfLines={1}>{sub}</T> : null}
    </Pressable>
  );
}

function IconBtn({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.75 : 1 })}
    >
      <Feather name={icon} size={20} color={C.ink} />
    </Pressable>
  );
}
