import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { adCache } from "@/lib/cache";
import { useAuth } from "@/lib/auth";
import { C, F } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { BRANDS } from "@/lib/cars";
import { AdCard, Button, CardSkeleton, StateView, T } from "@/components/ui";
import { useLiveSync } from "@/lib/live";
import type { PublicAd } from "@/lib/types";

const PAGE = 20;
type Cat = "all" | "new" | "old";
type Sort = "new" | "price_asc" | "price_desc";

export default function Home() {
  const { settings, session } = useAuth();
  const signedIn = !!session;
  const cy = settings.cutoff_year;
  const [cat, setCat] = useState<Cat>("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [ads, setAds] = useState<PublicAd[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const loadedRef = useRef(0);
  loadedRef.current = ads.length;

  /** offset-оос эхлэн size ширхэг зар ачаална. offset=0 бол жагсаалтыг бүхэлд нь солино. */
  const load = useCallback(
    async (offset = 0, size = PAGE) => {
      try {
        setError(null);
        const build = (withFeatured: boolean) => {
          let req = supabase.from("public_ads").select("*", { count: "exact" });
          if (cat !== "all") req = req.eq("category", cat);
          const term = query.replace(/[,()%*]/g, " ").trim();
          if (term) req = req.or(`brand.ilike.%${term}%,model.ilike.%${term}%,trim.ilike.%${term}%`);
          if (brand) req = req.eq("brand", brand);
          // Онцлох (VIP) зар эхэндээ
          if (withFeatured && sort !== "price_asc" && sort !== "price_desc") req = req.order("featured", { ascending: false });
          if (sort === "price_asc") req = req.order("price", { ascending: true });
          else if (sort === "price_desc") req = req.order("price", { ascending: false });
          else req = req.order("approved_at", { ascending: false, nullsFirst: false });
          return req.range(offset, offset + size - 1);
        };
        let res = await build(true);
        if (res.error?.code === "42703") res = await build(false); // SQL шинэчлэгдээгүй үед
        const { data, error: e, count: c } = res;
        if (e) throw e;
        setCount(c ?? 0);
        setAds((prev) => (offset ? [...prev, ...((data ?? []) as PublicAd[])] : ((data ?? []) as PublicAd[])));
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cat, query, brand, sort],
  );

  useEffect(() => {
    setLoading(true);
    load(0);
  }, [load]);


  // Шинэ зар батлагдах, зарагдах, устгагдахад жагсаалт шууд шинэчлэгдэнэ.
  // Одоо ачаалсан хэмжээгээрээ чимээгүй дахин татна — 1-р хуудас руу үсрэхгүй, гүйлгэсэн байрлал хадгалагдана.
  useLiveSync(() => load(0, Math.max(PAGE, loadedRef.current)), ["ads"]);
  // Уншаагүй мэдэгдлийн тоо (зөвхөн нэвтэрсэн үед)
  const loadUnread = useCallback(() => {
    if (!signedIn) return setUnread(0);
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false).then(({ count: c }) => setUnread(c ?? 0));
  }, [signedIn]);
  useEffect(() => { loadUnread(); }, [loadUnread]);
  useLiveSync(loadUnread, ["ads", "*"]);

  const tabs: { key: Cat; label: string }[] = [
    { key: "all", label: "Бүгд" },
    { key: "new", label: `${cy} ба хойш` },
    { key: "old", label: `${cy}-аас өмнө` },
  ];

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 38, height: 26, borderWidth: 2, borderColor: C.ink, borderRadius: 5, alignItems: "center", justifyContent: "center" }}>
            <T w="monoBold" style={{ fontSize: 12 }}>МЗ</T>
          </View>
          <T w="display" style={{ fontSize: 15 }}>Машин зар</T>
        </View>
        <Pressable accessibilityLabel="Мэдэгдэл" onPress={() => router.push("/notifications")} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.line2, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}>
          <Feather name="bell" size={20} color={C.ink} />
          {unread > 0 && <View style={{ position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.dot, borderWidth: 2, borderColor: C.card }} />}
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 14, backgroundColor: C.card, borderWidth: query ? 2 : 1, borderColor: query ? C.ink : C.line2, borderRadius: 12 }}>
        <Feather name="search" size={19} color={C.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setQuery(q)}
          returnKeyType="search"
          placeholder="Марк, загвар, сер хайх"
          placeholderTextColor="#9AA0A9"
          accessibilityLabel="Хайх"
          style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink }}
        />
        {q.length > 0 && (
          <Pressable accessibilityLabel="Цэвэрлэх" onPress={() => { setQ(""); setQuery(""); }} hitSlop={10}>
            <Feather name="x" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.soft, borderRadius: 12 }}>
        {tabs.map((t) => {
          const on = t.key === cat;
          return (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setCat(t.key)} style={{ flex: 1, height: 40, borderRadius: 9, backgroundColor: on ? C.ink : "transparent", alignItems: "center", justifyContent: "center" }}>
              <T w={on ? "semibold" : "medium"} style={{ fontSize: 13, color: on ? C.yellow : C.body }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip icon="filter" label={brand ?? "Марк"} on={!!brand || showFilters} onPress={() => setShowFilters((v) => !v)} />
        <Chip label="Шинэ нь эхэндээ" on={sort === "new"} onPress={() => setSort("new")} />
        <Chip label="Үнэ ↑" on={sort === "price_asc"} onPress={() => setSort("price_asc")} />
        <Chip label="Үнэ ↓" on={sort === "price_desc"} onPress={() => setSort("price_desc")} />
      </ScrollView>
      {showFilters && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="Бүх марк" on={!brand} onPress={() => setBrand(null)} />
          {Object.keys(BRANDS).map((b) => (
            <Chip key={b} label={b} on={brand === b} onPress={() => { setBrand(b); setShowFilters(false); }} />
          ))}
        </View>
      )}
      <T style={{ fontSize: 13, color: C.muted }}>{loading ? "Уншиж байна…" : `${count} зар`}</T>
    </View>
  );

  if (error && ads.length === 0)
    return (
      <StateView icon="warning" title="Алдаа гарлаа" text={`Зар ачаалж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.\n(${error})`}>
        <Button title="Дахин оролдох" icon="refresh-cw" onPress={() => { setLoading(true); load(0); }} />
      </StateView>
    );

  return (
    <FlatList
      data={loading ? [] : ads}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 14 }}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor={C.ink} />}
      renderItem={({ item }) => <AdCard ad={item} cy={cy} onPress={() => { adCache.set(item.id, item); router.push(`/ads/${item.id}`); }} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (!loading && ads.length < count) load(ads.length); }}
      ListEmptyComponent={
        loading ? (
          <View style={{ gap: 14 }}><CardSkeleton /><CardSkeleton /></View>
        ) : (
          <View style={{ alignItems: "center", gap: 14, paddingVertical: 40 }}>
            <View style={{ width: 96, height: 96, borderRadius: 26, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
              <Feather name="search" size={42} color={C.ink} />
            </View>
            <T w="display" style={{ fontSize: 20 }}>Илэрц олдсонгүй</T>
            <T style={{ textAlign: "center", color: C.body, lineHeight: 22 }}>
              {query || brand ? "Шүүлтүүрээ сулруулах эсвэл ийм зар орохоор мэдэгдэл авах боломжтой." : "Одоогоор идэвхтэй зар алга. Анхны зараа тавиарай!"}
            </T>
            {(query || brand) ? (
              <Button title="Шүүлтүүр цэвэрлэх" variant="ghost" onPress={() => { setQ(""); setQuery(""); setBrand(null); }} style={{ alignSelf: "stretch" }} />
            ) : (
              <Button title="Зар нэмэх" onPress={() => router.push("/post")} style={{ alignSelf: "stretch" }} />
            )}
          </View>
        )
      }
    />
  );
}

function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress: () => void; icon?: keyof typeof Feather.glyphMap }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? C.ink : C.line2, backgroundColor: on ? C.ink : C.card, flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon && <Feather name={icon} size={15} color={on ? C.paper : C.ink} />}
      <T style={{ fontSize: 13, color: on ? C.paper : C.ink }}>{label}</T>
    </Pressable>
  );
}
