import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { GuestGate } from "@/components/GuestGate";
import { C } from "@/lib/theme";
import { errMsg, money } from "@/lib/format";
import { Button, CardSkeleton, Photo, StateView, StatusBadge, T, s } from "@/components/ui";
import type { Ad, AdStatus, PublicAd } from "@/lib/types";
import { useLiveSync } from "@/lib/live";
import { confirm, openContract, staffRpc } from "@/lib/staff";
import { expiryInfo, isFeatured, recentlyRequested } from "@/lib/commission";

type Tab = "all" | AdStatus | "saved";

function MyAdsInner() {
  const { session, profile, settings } = useAuth();
  const dealer = profile?.role === "dealer";
  const uid = session?.user.id;
  const [ads, setAds] = useState<Ad[]>([]);
  const [saved, setSaved] = useState<PublicAd[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: e } = await supabase.from("ads").select("*").eq("user_id", uid).order("created_at", { ascending: false });
      if (e) throw e;
      setAds((data ?? []) as Ad[]);
      const { data: favs } = await supabase.from("favorites").select("ad_id").eq("user_id", uid);
      const ids = (favs ?? []).map((f) => f.ad_id);
      if (ids.length) {
        const { data: fa } = await supabase.from("public_ads").select("*").in("id", ids);
        setSaved((fa ?? []) as PublicAd[]);
      } else setSaved([]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // Менежер батлах, санал илгээх, зарагдсан болгоход төлөв шууд солигдоно
  useLiveSync(() => load(), ["ads"]);

  async function remove(a: Ad) {
    const ok = await confirm("Зар устгах уу?", `${a.brand} ${a.model} зарыг бүр мөсөн устгана. Энэ үйлдлийг буцаах боломжгүй.`, "Устгах", true);
    if (!ok) return;
    const { data, error: e } = await supabase.from("ads").delete().eq("id", a.id).select("id");
    if (e) return Alert.alert("Устгаж чадсангүй", errMsg(e));
    // RLS: борлуулалтын тайлантай зарыг устгахгүй — алдаагүй ч 0 мөр устана
    if (!data || data.length === 0) return Alert.alert("Устгах боломжгүй", "Энэ зарт борлуулалтын тайлан бүртгэгдсэн тул устгах боломжгүй");
    setAds((x) => x.filter((y) => y.id !== a.id));
    if (a.photos.length) supabase.storage.from("ad-photos").remove(a.photos).then(() => {}, () => {});
  }

  const count = (t: Tab) => (t === "all" ? ads.length : t === "saved" ? saved.length : ads.filter((a) => a.status === t).length);
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Бүгд" },
    ...(dealer ? [] : [{ key: "pending" as Tab, label: "Хүлээгдэж" }]),
    { key: "active", label: "Идэвхтэй" },
    ...(dealer ? [{ key: "hidden" as Tab, label: "Нуусан" }] : []),
    { key: "sold", label: "Зарагдсан" },
    { key: "saved", label: "Хадгалсан" },
  ];

  async function setStatus(a: Ad, status: "active" | "hidden" | "sold") {
    if (status === "sold") {
      const ok = await confirm("Зарагдсан гэж тэмдэглэх үү?", `${a.brand} ${a.model} нийтээс хасагдана.`, "Тийм");
      if (!ok) return;
    }
    const r = await staffRpc("dealer_set_status", { p_ad: a.id, p_status: status, p_price: null });
    if (r.ok) load();
  }
  async function renew(a: Ad) {
    const r = await staffRpc("renew_ad", { p_ad: a.id });
    if (r.ok) {
      Alert.alert("Зар сунгагдлаа", `${settings.ad_days} хоног нийтэд харагдана.`);
      load();
    }
  }

  async function askFeatured(a: Ad) {
    const ok = await confirm(
      "Зараа онцлох уу?",
      `${settings.featured_days ?? 7} хоног жагсаалтын эхэнд, тодорсон байдлаар харагдана. Үнэ: ${money(settings.featured_price ?? 50000)}. Менежер тантай холбогдож төлбөрийг тохирно.`,
      "Хүсэлт илгээх",
    );
    if (!ok) return;
    const r = await staffRpc("request_featured", { p_ad: a.id });
    if (r.ok) {
      Alert.alert("Хүсэлт илгээгдлээ", "Менежер удахгүй холбогдоно.");
      load();
    }
  }

  const shown = tab === "all" ? ads : tab === "saved" ? [] : ads.filter((a) => a.status === tab);

  if (error && !ads.length)
    return <StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); load(); }} /></StateView>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 14 }}>
        <T w="display" style={{ fontSize: 22 }}>Миний зарууд</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
          {tabs.map((t) => (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => setTab(t.key)} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: tab === t.key ? C.ink : C.card, borderWidth: tab === t.key ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}>
              <T w={tab === t.key ? "semibold" : "body"} style={{ fontSize: 13, color: tab === t.key ? C.yellow : C.ink }}>{t.label} {count(t.key)}</T>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {tab === "saved" ? (
        <FlatList
          data={saved}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
          ListEmptyComponent={<T style={{ textAlign: "center", color: C.muted, paddingVertical: 40 }}>Хадгалсан зар алга. Зарын ♡ товчийг дарж хадгална.</T>}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/ads/${item.id}`)} style={[s.card, { flexDirection: "row", gap: 12, padding: 12 }]}>
              <Photo path={item.photos[0]} style={{ width: 84, height: 84, borderRadius: 10 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <T w="semibold">{item.brand} {item.model} · {item.year_made}</T>
                <T w="display" style={{ fontSize: 15 }}>{money(item.price)}</T>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={loading ? [] : shown}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
          ListEmptyComponent={
            loading ? <View style={{ gap: 12 }}><CardSkeleton /></View> : (
              <View style={{ alignItems: "center", gap: 14, paddingVertical: 40 }}>
                <T style={{ color: C.body }}>Энд зар алга байна.</T>
                <Button title="Зар нэмэх" onPress={() => router.push("/post")} style={{ alignSelf: "stretch" }} />
              </View>
            )
          }
          renderItem={({ item: a }) => (
            <View style={[s.card, { padding: 12, gap: 12 }]}>
              <Pressable onPress={() => router.push(`/ads/${a.id}`)} style={{ flexDirection: "row", gap: 12 }}>
                <Photo path={a.photos[0]} style={{ width: 84, height: 84, borderRadius: 10, opacity: a.status === "sold" ? 0.6 : 1 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <StatusBadge s={a.status} />
                  <T w="semibold" style={{ color: a.status === "sold" ? C.body : C.ink }}>{a.brand} {a.model} · {a.year_made}</T>
                  <T w="display" style={{ fontSize: 15, color: a.status === "sold" ? C.body : C.ink, textDecorationLine: a.status === "sold" ? "line-through" : "none" }}>{money(a.price)}</T>
                  <AdLife a={a} />
                </View>
              </Pressable>
              {(a.status !== "sold" || a.contract_id) && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: dealer ? "flex-start" : "space-between", borderTopWidth: 1, borderColor: "#ECEDE9", paddingTop: 10, gap: 8 }}>
                  <T style={{ fontSize: 12, color: a.offer_amount ? C.pendingFg : C.muted, flex: dealer ? undefined : 1, flexBasis: dealer ? "100%" : undefined }} w={a.offer_amount ? "semibold" : "body"}>
                    {a.offer_amount ? `Санал: ${money(a.offer_amount)}` : a.status === "pending" ? "Менежер удахгүй холбогдоно" : a.status === "rejected" ? "Татгалзагдсан" : `${a.views} үзэлт`}
                  </T>
                  {a.contract_id ? <Button small title="Гэрээ" icon="file-text" variant="ghost" onPress={() => openContract(a.contract_id!)} /> : null}
                  {(a.status === "active" || a.status === "hidden") && expiryInfo(a.expires_at).renewable ? (
                    <Button small title="Сунгах" icon="refresh-cw" variant="yellow" onPress={() => renew(a)} />
                  ) : null}
                  {a.status === "active" && !expiryInfo(a.expires_at).expired && !isFeatured(a.featured_until) && !recentlyRequested(a.featured_requested_at) ? (
                    <Button small title="Онцлох" icon="star" variant="ghost" onPress={() => askFeatured(a)} />
                  ) : null}
                  {dealer && a.status !== "sold" ? (
                    <>
                      <Button small title="Засах" icon="edit-2" variant="ghost" onPress={() => router.push(`/edit/${a.id}`)} />
                      {(a.status === "active" || a.status === "hidden") && (
                        <Button small title={a.status === "active" ? "Нуух" : "Гаргах"} icon={a.status === "active" ? "eye-off" : "eye"} variant="ghost" onPress={() => setStatus(a, a.status === "active" ? "hidden" : "active")} />
                      )}
                      <Button small title="Зарагдсан" icon="check" onPress={() => setStatus(a, "sold")} />
                    </>
                  ) : null}
                  {a.status !== "sold" && <Button small title="Устгах" icon="trash-2" variant="danger" onPress={() => remove(a)} />}
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

/** Нийтлэгдсэн зарын хугацаа, онцлох төлөв */
function AdLife({ a }: { a: Ad }) {
  if (a.status !== "active" && a.status !== "hidden") return null;
  const e = expiryInfo(a.expires_at);
  return (
    <View style={{ gap: 2 }}>
      {!e.none && (
        <T w="semibold" style={{ fontSize: 12, color: e.expired ? C.danger : e.renewable ? C.pendingFg : C.muted }}>
          {e.expired ? "Хугацаа дууссан — нийтэд харагдахгүй" : `${e.daysLeft} хоног үлдсэн`}
        </T>
      )}
      {isFeatured(a.featured_until) ? <T w="semibold" style={{ fontSize: 12, color: C.pendingFg }}>⭐ Онцлох зар</T> : null}
      {recentlyRequested(a.featured_requested_at) ? <T style={{ fontSize: 12, color: C.muted }}>⭐ Онцлох хүсэлт илгээсэн</T> : null}
    </View>
  );
}

export default function MyAds() {
  return (
    <GuestGate icon="list" title="Миний зар" text="Нэвтэрч зараа тавих, хадгалсан машинуудаа харна." next="/my">
      <MyAdsInner />
    </GuestGate>
  );
}
