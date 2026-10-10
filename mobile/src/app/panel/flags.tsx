import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg, money, timeAgo } from "@/lib/format";
import { confirm, isStaff, staffRpc } from "@/lib/staff";
import { useLiveSync } from "@/lib/live";
import { Button, CardSkeleton, Input, Photo, StateView, T, s } from "@/components/ui";
import { FLAG_REASONS } from "@/components/ReportAdSheet";

type Flag = {
  id: string; ad_id: string; reason: string; note: string | null; created_at: string;
  ad: { id: string; brand: string; model: string; year_made: number; price: number; photos: string[]; status: string; phone: string } | null;
  reporter: { full_name: string | null; phone: string | null } | null;
};
const REASON = Object.fromEntries(FLAG_REASONS.map((r) => [r.key, r.label]));

export default function FlagsScreen() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Flag[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data, error: e } = await supabase
        .from("ad_flags")
        .select("*, ad:ads(id,brand,model,year_made,price,photos,status,phone), reporter:profiles!ad_flags_user_id_fkey(full_name,phone)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(200);
      if (e) throw e;
      const m = new Map<string, Flag[]>();
      for (const f of (data ?? []) as unknown as Flag[]) m.set(f.ad_id, [...(m.get(f.ad_id) ?? []), f]);
      setGroups([...m.values()]);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useLiveSync(() => load(), ["ad_flags"]);

  async function act(f: Flag, action: "hide" | "resolve" | "dismiss") {
    if (action === "hide" && !(await confirm("Зарыг нуух уу?", "Зар нийтээс хасагдаж, эзэнд нь мэдэгдэл очно.", "Нуух", true))) return;
    const r = await staffRpc("resolve_flag", { p_id: f.id, p_action: action, p_note: notes[f.ad_id]?.trim() || null });
    if (r.ok) load();
  }

  if (!isStaff(profile)) return <StateView icon="lock" title="Эрх хүрэхгүй" text="Зөвхөн менежер, админд."><Button title="Буцах" onPress={() => router.back()} /></StateView>;
  if (error) return <StateView icon="warning" title="Алдаа гарлаа" text={error}><Button title="Дахин оролдох" onPress={load} /></StateView>;

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 }}>
        <Pressable accessibilityLabel="Буцах" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
          <Feather name="chevron-left" size={22} color={C.ink} />
        </Pressable>
        <T w="display" style={{ fontSize: 20 }}>Гомдол</T>
      </View>
      <FlatList
        data={groups ?? []}
        keyExtractor={(g) => g[0].ad_id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
        ListEmptyComponent={groups ? <T style={{ textAlign: "center", color: C.muted, paddingVertical: 40 }}>Шийдвэрлэх гомдол алга 👍</T> : <CardSkeleton />}
        renderItem={({ item: list }) => {
          const f = list[0];
          const a = f.ad;
          return (
            <View style={[s.card, { padding: 12, gap: 10 }]}>
              <Pressable onPress={() => a && router.push(`/panel/ad/${a.id}`)} style={{ flexDirection: "row", gap: 12 }}>
                <Photo path={a?.photos[0]} style={{ width: 72, height: 72, borderRadius: 10 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T w="semibold">{a ? `${a.brand} ${a.model} · ${a.year_made}` : "Устгагдсан зар"}</T>
                  {a ? <T style={{ fontSize: 13, color: C.muted }}>{money(a.price)} · {a.phone}</T> : null}
                  <T w="semibold" style={{ fontSize: 12, color: C.danger }}>{list.length} гомдол</T>
                </View>
              </Pressable>
              {list.map((x) => (
                <View key={x.id} style={{ backgroundColor: C.paper, borderRadius: 10, padding: 10, gap: 3 }}>
                  <T w="semibold" style={{ fontSize: 13 }}>{REASON[x.reason] ?? x.reason}</T>
                  {x.note ? <T style={{ fontSize: 13 }}>“{x.note}”</T> : null}
                  <T style={{ fontSize: 12, color: C.muted }}>{x.reporter?.full_name ?? "Хэрэглэгч"}{x.reporter?.phone ? ` · ${x.reporter.phone}` : ""} · {timeAgo(x.created_at)}</T>
                </View>
              ))}
              <Input value={notes[f.ad_id] ?? ""} onChangeText={(t) => setNotes((n) => ({ ...n, [f.ad_id]: t }))} placeholder="Тэмдэглэл / эзэнд очих шалтгаан" />
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {a?.status === "active" && <Button small variant="danger" icon="eye-off" title="Зарыг нуух" onPress={() => act(f, "hide")} />}
                <Button small icon="check" title="Зассан" onPress={() => act(f, "resolve")} />
                <Button small variant="ghost" title="Үндэслэлгүй" onPress={() => act(f, "dismiss")} />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
