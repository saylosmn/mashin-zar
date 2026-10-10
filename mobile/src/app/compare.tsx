import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { categoryLong, errMsg, money } from "@/lib/format";
import { bestIndexes, useCompare } from "@/lib/compare";
import { Button, Photo, Skeleton, StateView, T } from "@/components/ui";
import type { PublicAd } from "@/lib/types";

const COL = 168;
const LABEL = 112;

export default function CompareScreen() {
  const { settings } = useAuth();
  const { ids, remove, clear } = useCompare();
  const [ads, setAds] = useState<PublicAd[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(",");

  const load = useCallback(async () => {
    if (!ids.length) return setAds([]);
    try {
      setError(null);
      const { data, error: e } = await supabase.from("public_ads").select("*").in("id", ids);
      if (e) throw e;
      const list = (data ?? []) as PublicAd[];
      setAds(ids.map((id) => list.find((a) => a.id === id)).filter((a): a is PublicAd => Boolean(a)));
    } catch (e) {
      setError(errMsg(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
      <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
        <Feather name="chevron-left" size={22} color={C.ink} />
      </Pressable>
      <T w="display" style={{ fontSize: 20, flex: 1 }}>Харьцуулах</T>
      {ids.length > 0 && <Button small variant="ghost" title="Цэвэрлэх" onPress={clear} />}
    </View>
  );

  if (error) return <View style={{ flex: 1, backgroundColor: C.paper }}>{header}<StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" onPress={load} /></StateView></View>;
  if (!ads) return <View style={{ flex: 1, backgroundColor: C.paper }}>{header}<View style={{ padding: 16, gap: 12 }}><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 300 }} /></View></View>;
  if (ads.length === 0)
    return (
      <View style={{ flex: 1, backgroundColor: C.paper }}>
        {header}
        <StateView icon="shuffle" title="Харьцуулах машин алга" text="Зарын дэлгэц дээрх «Харьцуулах» товчоор 2–3 машин сонгоно уу.">
          <Button title="Зарууд үзэх" onPress={() => router.replace("/")} />
        </StateView>
      </View>
    );

  const cy = settings.cutoff_year;
  const rows: { label: string; values: string[]; best?: number[] }[] = [
    { label: "Үнэ", values: ads.map((a) => money(a.price)), best: bestIndexes(ads.map((a) => a.price), "min") },
    { label: "Үйлдвэрлэсэн он", values: ads.map((a) => String(a.year_made)), best: bestIndexes(ads.map((a) => a.year_made), "max") },
    { label: "Орж ирсэн он", values: ads.map((a) => (a.year_imported ? String(a.year_imported) : "—")), best: bestIndexes(ads.map((a) => a.year_imported), "max") },
    { label: "Ангилал", values: ads.map((a) => categoryLong(a.category, cy)) },
    { label: "Сер", values: ads.map((a) => a.trim || "—") },
    { label: "Улсын дугаар", values: ads.map((a) => a.plate_masked) },
    { label: "Опшны тоо", values: ads.map((a) => String(a.options.length)), best: bestIndexes(ads.map((a) => a.options.length), "max") },
    { label: "Нэмж хийсэн", values: ads.map((a) => a.modifications || "—") },
    { label: "Худалдагч", values: ads.map((a) => `${a.seller_shop ?? a.seller_name}${a.seller_city ? ` · ${a.seller_city}` : ""}`) },
  ];
  const allOptions = Array.from(new Set(ads.flatMap((a) => a.options))).sort((a, b) => a.localeCompare(b));

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {header}
      {ads.length < 2 && <T style={{ paddingHorizontal: 16, paddingBottom: 8, fontSize: 13, color: C.muted }}>Дахиад машин нэмбэл зэрэгцүүлж харна.</T>}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <View>
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: LABEL }} />
              {ads.map((a) => (
                <View key={a.id} style={{ width: COL, paddingHorizontal: 6, gap: 6, paddingBottom: 10 }}>
                  <Pressable onPress={() => router.push(`/ads/${a.id}`)} style={{ gap: 6 }}>
                    <Photo path={a.photos[0]} style={{ width: COL - 12, height: 100, borderRadius: 10 }} />
                    <T w="bold" style={{ fontSize: 14 }} numberOfLines={2}>{a.brand} {a.model}{a.featured ? " ⭐" : ""}</T>
                  </Pressable>
                  <Pressable onPress={() => remove(a.id)} hitSlop={8}><T style={{ fontSize: 12, color: C.muted, textDecorationLine: "underline" }}>Хасах</T></Pressable>
                </View>
              ))}
            </View>
            {rows.map((r, ri) => (
              <View key={r.label} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: C.line, backgroundColor: ri % 2 ? "transparent" : C.card }}>
                <View style={{ width: LABEL, padding: 10, justifyContent: "center" }}><T style={{ fontSize: 12, color: C.muted }}>{r.label}</T></View>
                {r.values.map((v, i) => (
                  <View key={ads[i].id} style={{ width: COL, padding: 10, backgroundColor: r.best?.includes(i) ? "rgba(245,184,0,.35)" : undefined }}>
                    <T w={r.best?.includes(i) ? "bold" : "body"} style={{ fontSize: 13 }}>{v}</T>
                  </View>
                ))}
              </View>
            ))}
            {allOptions.length > 0 && (
              <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: C.line }}>
                <View style={{ width: LABEL, padding: 10 }}><T style={{ fontSize: 12, color: C.muted }}>Опшн</T></View>
                {ads.map((a) => (
                  <View key={a.id} style={{ width: COL, padding: 10, gap: 4 }}>
                    {allOptions.map((o) => {
                      const has = a.options.includes(o);
                      return <T key={o} style={{ fontSize: 12, color: has ? C.ink : C.muted, textDecorationLine: has ? "none" : "line-through" }}>{has ? "✓" : "✕"} {o}</T>;
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
