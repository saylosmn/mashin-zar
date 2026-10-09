import { useCallback, useEffect, useState } from "react";
import { Dimensions, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg, initial, money, timeAgo } from "@/lib/format";
import { Button, CatChip, Photo, Skeleton, StateView, StatusBadge, T, s } from "@/components/ui";
import type { Ad, PublicAd } from "@/lib/types";
import { useLiveSync } from "@/lib/live";
import { adCache } from "@/lib/cache";
import type { Partner } from "@/lib/loan";
import { LoanCalculator } from "@/components/LoanCalculator";

const W = Dimensions.get("window").width;

export default function AdDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, settings, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [ad, setAd] = useState<PublicAd | null>(() => adCache.get(id) ?? null);
  const [loading, setLoading] = useState(() => !adCache.has(id));
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [fav, setFav] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const uid = session?.user.id;

  const load = useCallback(async () => {
    try {
      setError(null);
      const favP = supabase.from("favorites").select("ad_id").eq("ad_id", id).maybeSingle();
      // Лизингийн түншүүд — алдаа гарвал тооцоолуур л харагдахгүй, зар нээгдэнэ
      supabase.from("leasing_partners").select("*").eq("active", true).order("name")
        .then(({ data: lp }) => setPartners((lp ?? []) as Partner[]), () => setPartners([]));
      const { data, error: e } = await supabase.from("public_ads").select("*").eq("id", id).maybeSingle();
      if (e) throw e;
      if (data) {
        setAd(data as PublicAd);
        if (data.user_id !== uid) supabase.rpc("increment_view", { p_ad: id }).then(() => {});
      } else {
        const { data: own } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
        if (own) {
          const a = own as Ad;
          setAd({ ...a, plate_masked: a.plate_number, vin_masked: a.vin, seller_name: "", seller_city: null, seller_ad_count: 0 } as PublicAd);
        } else setAd(null);
      }
      const { data: f } = await favP;
      setFav(!!f);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [id, uid]);

  useEffect(() => { load(); }, [load]);
  useLiveSync((e) => { if (e.table === "leasing_partners" || !e.id || e.id === id) load(); }, ["ads", "leasing_partners"]);

  async function toggleFav() {
    const next = !fav;
    setFav(next);
    if (next) await supabase.from("favorites").upsert({ user_id: uid, ad_id: id });
    else await supabase.from("favorites").delete().eq("ad_id", id).eq("user_id", uid);
  }

  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: C.paper }}>
        <Skeleton style={{ height: 300, borderRadius: 0 }} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton style={{ width: "70%", height: 24 }} />
          <Skeleton style={{ width: "45%", height: 28 }} />
          <Skeleton style={{ height: 120, borderRadius: 12 }} />
        </View>
      </View>
    );
  if (error) return <StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); load(); }} /><Button title="Буцах" variant="ghost" onPress={() => router.back()} /></StateView>;
  if (!ad) return <StateView icon="slash" title="Зар олдсонгүй" text="Зар устгагдсан, зарагдсан эсвэл холбоос буруу байж магадгүй."><Button title="Бүх зар руу" onPress={() => router.replace("/")} /></StateView>;

  const mine = ad.user_id === uid;
  const cy = settings.cutoff_year;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View>
          {ad.photos.length ? (
            <FlatList
              data={ad.photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(p) => p}
              onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
              renderItem={({ item }) => <Photo path={item} style={{ width: W, height: 300 }} />}
            />
          ) : (
            <Photo style={{ width: W, height: 300 }} />
          )}
          <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ position: "absolute", left: 16, top: 16, width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
            <Feather name="chevron-left" size={22} color={C.ink} />
          </Pressable>
          {!mine && (
            <Pressable accessibilityLabel={fav ? "Хадгалснаас хасах" : "Хадгалах"} onPress={toggleFav} style={{ position: "absolute", right: 16, top: 16, width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
              <Feather name="heart" size={20} color={fav ? "#C0262D" : C.ink} />
            </Pressable>
          )}
          {ad.photos.length > 0 && (
            <View style={{ position: "absolute", right: 16, bottom: 14, backgroundColor: C.ink, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <T w="mono" style={{ color: C.paper, fontSize: 12 }}>{idx + 1} / {ad.photos.length}</T>
            </View>
          )}
        </View>

        <View style={{ padding: 20, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <CatChip c={ad.category} cy={cy} />
              {ad.status !== "active" && <StatusBadge s={ad.status} />}
              <T style={{ fontSize: 12, color: C.muted }}>{timeAgo(ad.approved_at ?? ad.created_at)}</T>
            </View>
            <T w="bold" style={{ fontSize: 24, lineHeight: 30 }}>{ad.brand} {ad.model}{ad.trim ? ` · ${ad.trim}` : ""}</T>
            <T w="display" style={{ fontSize: 26 }}>{money(ad.price)}</T>
          </View>

          {ad.status === "pending" && (
            <View style={{ backgroundColor: C.pendingBg, borderRadius: 12, padding: 12 }}>
              <T style={{ color: C.pendingFg, fontSize: 14, lineHeight: 20 }}>Энэ зар менежерийн шалгалтыг хүлээж байна. Батлагдсаны дараа бусдад харагдана.</T>
            </View>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["Үйлдвэрлэсэн он", String(ad.year_made), false],
              ["Орж ирсэн он", ad.year_imported ? String(ad.year_imported) : "—", false],
              ["Улсын дугаар", ad.plate_masked, true],
              ["Арлын дугаар", ad.vin_masked, true],
            ].map(([k, v, mono]) => (
              <View key={String(k)} style={{ width: (W - 48) / 2, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, gap: 4 }}>
                <T style={{ fontSize: 12, color: C.muted }}>{k}</T>
                <T w={mono ? "monoBold" : "semibold"} style={{ fontSize: mono ? 14 : 16 }}>{v}</T>
              </View>
            ))}
          </View>

          <View style={{ gap: 10 }}>
            <T w="bold" style={s.h2}>Машин ба сер</T>
            <View style={[s.card]}>
              {[["Марк", ad.brand], ["Загвар", ad.model], ["Сер", ad.trim || "—"], ["Үзэлт", String(ad.views)]].map(([k, v], i) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", padding: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderColor: "#ECEDE9" }}>
                  <T style={{ fontSize: 14, color: C.muted }}>{k}</T>
                  <T w="semibold" style={{ fontSize: 14 }}>{v}</T>
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <T w="bold" style={s.h2}>Нэмэлт опшн</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ad.options.length ? ad.options.map((o) => (
                <View key={o} style={{ paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, borderRadius: 16 }}>
                  <T style={{ fontSize: 13 }}>{o}</T>
                </View>
              )) : <T style={{ color: C.muted, fontSize: 14 }}>Оруулаагүй</T>}
            </View>
          </View>

          {ad.modifications ? (
            <View style={{ gap: 10 }}>
              <T w="bold" style={s.h2}>Нэмж хийсэн зүйлс</T>
              <T style={{ fontSize: 14, lineHeight: 21 }}>{ad.modifications}</T>
            </View>
          ) : null}
          {ad.description ? (
            <View style={{ gap: 10 }}>
              <T w="bold" style={s.h2}>Тайлбар</T>
              <T style={{ fontSize: 14, lineHeight: 22, color: "#2B2F35" }}>{ad.description}</T>
            </View>
          ) : null}

          {!mine && ad.status === "active" && partners.length > 0 && (
            <LoanCalculator
              key={ad.id + ad.price}
              adId={ad.id}
              price={ad.price}
              partners={partners}
              defaultName={profile?.full_name ?? ""}
              defaultPhone={profile?.phone ?? ""}
            />
          )}

          {ad.seller_name ? (
            <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }]}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ad.seller_shop ? C.yellow : C.ink, alignItems: "center", justifyContent: "center" }}>
                {ad.seller_shop ? <Feather name="shopping-bag" size={18} color={C.ink} /> : <T w="bold" style={{ color: C.yellow }}>{initial(ad.seller_name)}</T>}
              </View>
              <View style={{ gap: 2 }}>
                {ad.seller_shop ? <T w="bold" style={{ fontSize: 10, color: C.pendingFg, letterSpacing: 0.5 }}>АВТО ХУДАЛДАА</T> : null}
                <T w="semibold" style={{ fontSize: 14 }}>{ad.seller_shop ?? ad.seller_name}</T>
                <T style={{ fontSize: 12, color: C.muted }}>{ad.seller_city ?? "Монгол"} · {ad.seller_ad_count} зар</T>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!mine && ad.status === "active" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line }}>
          {showPhone ? (
            <Button title={ad.phone} icon="phone" variant="yellow" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${ad.phone}`)} />
          ) : (
            <Button title="Дугаар харах" icon="phone" variant="yellow" style={{ flex: 1 }} onPress={() => setShowPhone(true)} />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
