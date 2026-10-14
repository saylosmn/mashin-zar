import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { errMsg, money } from "@/lib/format";
import { termsFrom } from "@shared/contract";
import { confirm, isAdmin, isStaff, staffRpc } from "@/lib/staff";
import { BackButton, Button, Skeleton, StateView, T } from "@/components/ui";
import type { Report } from "@/features/reports/types";
import { ReportCard } from "@/features/reports/ReportCard";
import { NewReport } from "@/features/reports/NewReport";

const SELECT =
  "*, ad:ads(id,brand,model,year_made,plate_number,contract_id), author:profiles!sale_reports_manager_id_fkey(full_name,email), agent:profiles!sale_reports_agent_id_fkey(full_name,agent_code)";

type Filter = "pending" | "approved" | "rejected" | "all";

export default function Reports() {
  const params = useLocalSearchParams<{ ad?: string }>();
  const { profile, settings } = useAuth();
  const admin = isAdmin(profile);
  const [rows, setRows] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Filter>(admin ? "pending" : "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(!!params.ad);
  const fallback = useMemo(() => termsFrom(settings).terms, [settings]);

  const load = useCallback(async () => {
    try {
      setError(null);
      let q = supabase.from("sale_reports").select(SELECT).order("created_at", { ascending: false }).limit(150);
      if (!admin) q = q.eq("manager_id", profile?.id ?? "");
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error: e } = await q;
      if (e) throw e;
      setRows((data ?? []) as unknown as Report[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [admin, filter, profile?.id]);

  useEffect(() => {
    load();
  }, [load]);
  useLiveSync(() => load(), ["sale_reports", "ads"]);

  if (!isStaff(profile))
    return (
      <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг зөвхөн админд нээлттэй.">
        <Button title="Буцах" onPress={() => router.back()} />
      </StateView>
    );

  async function review(r: Report, approve: boolean, note: string) {
    const ok = await confirm(
      approve ? "Тайлан батлах уу?" : "Тайлан буцаах уу?",
      approve
        ? `${r.ad?.brand ?? ""} ${r.ad?.model ?? ""} “зарагдсан” болж, эзэнд нь мэдэгдэл очно.`
        : "Илгээсэн хүнд буцаагдсан тухай мэдэгдэл очно.",
      approve ? "Батлах" : "Буцаах",
      !approve,
    );
    if (!ok) return;
    const res = await staffRpc("review_sale_report", { p_id: r.id, p_approve: approve, p_note: note.trim() || null });
    if (res.ok) load();
  }

  async function markPaid(r: Report, paid: boolean) {
    const ok = await confirm(
      paid ? "Агентад төлсөн үү?" : "Төлөөгүй болгох уу?",
      paid ? `${money(r.agent_amount ?? 0)} шилжүүлсэн гэж тэмдэглэнэ.` : "",
      "Тийм",
    );
    if (!ok) return;
    const res = await staffRpc("set_agent_paid", { p_id: r.id, p_paid: paid });
    if (res.ok) load();
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "pending", label: "Хүлээгдэж буй" },
    { key: "approved", label: "Батлагдсан" },
    { key: "rejected", label: "Буцаагдсан" },
    { key: "all", label: "Бүгд" },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.ink} />}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <BackButton />
              <View style={{ flex: 1 }}>
                <T w="display" style={{ fontSize: 20 }}>
                  {admin ? "Тайлангууд" : "Тайлан"}
                </T>
                <T style={{ fontSize: 12, color: C.muted }}>Борлуулалтын тайлан</T>
              </View>
              {!formOpen && (
                <Button small title="Шинэ" icon="plus" variant="yellow" onPress={() => setFormOpen(true)} />
              )}
            </View>
            {formOpen && (
              <NewReport
                defaultAd={params.ad}
                fallback={fallback}
                onClose={() => setFormOpen(false)}
                onSent={() => {
                  setFormOpen(false);
                  setFilter("all");
                  load();
                }}
              />
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {filters.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      if (on) return;
                      setLoading(true);
                      setFilter(f.key);
                    }}
                    style={{
                      height: 36,
                      paddingHorizontal: 14,
                      borderRadius: 18,
                      backgroundColor: on ? C.ink : C.card,
                      borderWidth: on ? 0 : 1,
                      borderColor: C.line2,
                      justifyContent: "center",
                    }}
                  >
                    <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>
                      {f.label}
                    </T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} style={{ height: 150, borderRadius: 14 }} />
              ))}
            </View>
          ) : error ? (
            <T style={{ color: C.danger, textAlign: "center", paddingVertical: 24 }}>{error}</T>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 30 }}>
              <Feather name="file-text" size={30} color={C.pale} />
              <T style={{ color: C.muted }}>Тайлан алга</T>
            </View>
          )
        }
        renderItem={({ item }) => <ReportCard r={item} admin={admin} onReview={review} onPaid={markPaid} />}
      />
    </KeyboardAvoidingView>
  );
}
