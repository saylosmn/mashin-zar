import { useCallback, useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLiveSync } from "@/lib/live";
import { C } from "@/lib/theme";
import { errMsg, num } from "@/lib/format";
import { openWebPanel } from "@/lib/staff";
import { type LoanRequest, type LoanStatus, type Partner } from "@/lib/loan";
import { Button, Skeleton, StateView, T } from "@/components/ui";
import { Kpi } from "@/components/stats";
import { BackButton } from "@/components/ui";
import { RequestCard } from "./RequestCard";
import { Terms } from "./PartnerTerms";
import { Chip } from "./bits";

type Tab = LoanStatus | "all" | "terms";

const TABS: { key: Tab; label: string }[] = [
  { key: "new", label: "Шинэ" },
  { key: "contacted", label: "Холбогдсон" },
  { key: "approved", label: "Зөвшөөрсөн" },
  { key: "rejected", label: "Татгалзсан" },
  { key: "all", label: "Бүгд" },
  { key: "terms", label: "Нөхцөл" },
];

type Stat = { status: LoanStatus; price: number; down_payment: number; created_at: string };
/** Админ бүх түншийн хүсэлтийг нэг дор харах сонголт */

const ALL = "all";

/** Лизингийн түншийн панел: хүсэлтүүд, төлөв, зээлийн нөхцөл. Админ бүх түншийг сонгож харна. */
export function LeasingPanel({ withBack }: { withBack?: boolean }) {
  const { profile } = useAuth();
  const admin = profile?.role === "admin";
  const allowed = admin || profile?.role === "leasing";
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [rows, setRows] = useState<LoanRequest[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allMode = admin && pid === ALL;
  const partner = partners
    ? admin
      ? (partners.find((p) => p.id === pid) ?? partners[0])
      : partners.find((p) => p.id === profile?.partner_id)
    : undefined;
  // "Бүгд" горимд түншээр шүүхгүй (зөвхөн админ)
  const partnerId = allMode ? ALL : partner?.id;

  const loadPartners = useCallback(async () => {
    const { data, error: e } = await supabase.from("leasing_partners").select("*").order("name");
    if (e) setError(errMsg(e));
    setPartners((data ?? []) as Partner[]);
  }, []);

  const loadRows = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const everyone = partnerId === ALL;
      let q = supabase.from("loan_requests").select("*").order("created_at", { ascending: false }).limit(200);
      let sq = supabase.from("loan_requests").select("status,price,down_payment,created_at");
      if (!everyone) {
        q = q.eq("partner_id", partnerId);
        sq = sq.eq("partner_id", partnerId);
      }
      if (tab !== "all" && tab !== "terms") q = q.eq("status", tab);
      const [list, all] = await Promise.all([q, sq]);
      if (list.error) throw list.error;
      setRows((list.data ?? []) as LoanRequest[]);
      setStats((all.data ?? []) as Stat[]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [partnerId, tab]);

  useEffect(() => {
    if (allowed) loadPartners();
  }, [allowed, loadPartners]);
  useEffect(() => {
    if (partners) loadRows();
  }, [partners, loadRows]);
  useLiveSync(
    (e) => {
      if (e.table === "leasing_partners") loadPartners();
      else loadRows();
    },
    ["loan_requests", "leasing_partners"],
  );

  const backBtn = withBack ? <BackButton /> : null;

  if (!allowed)
    return (
      <StateView icon="lock" title="Эрх хүрэхгүй" text="Энэ хэсэг лизингийн түнш, админд нээлттэй.">
        <Button title="Буцах" onPress={() => (withBack ? router.back() : router.replace("/"))} />
      </StateView>
    );
  if (!partners)
    return (
      <View style={{ padding: 16, gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ height: 110, borderRadius: 14 }} />
        ))}
      </View>
    );
  if (!partner)
    return (
      <StateView
        icon="briefcase"
        title="Лизингийн панел"
        text={
          admin
            ? "Лизингийн компани бүртгэгдээгүй байна. Вэб админ → Лизинг хэсгээс нэмнэ үү."
            : "Таны аккаунт лизингийн компанитай холбогдоогүй байна. Админтай холбогдоно уу."
        }
      >
        {admin ? (
          <Button title="Вэб админ → Лизинг" icon="external-link" onPress={() => openWebPanel("/admin/leasing")} />
        ) : null}
        {withBack ? <Button title="Буцах" variant="ghost" onPress={() => router.back()} /> : null}
      </StateView>
    );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const count = (k: LoanStatus) => stats.filter((r) => r.status === k).length;
  const month = stats.filter((r) => r.created_at >= monthStart);
  const approved = stats.filter((r) => r.status === "approved");
  const decided = approved.length + count("rejected");
  const trialDays =
    !allMode && partner.trial_until
      ? Math.ceil((new Date(partner.trial_until).getTime() - now.getTime()) / 864e5)
      : null;
  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? "—";
  const tabs = allMode ? TABS.filter((t) => t.key !== "terms") : TABS;
  const pickTab = (k: Tab) => {
    if (k !== tab) {
      setLoading(k !== "terms");
      setTab(k);
    }
  };
  const pickPartner = (id: string) => {
    if (id === (allMode ? ALL : partner.id)) return;
    setLoading(true);
    if (id === ALL && tab === "terms") setTab("new");
    setPid(id);
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {backBtn}
        <View style={{ flex: 1, gap: 2 }}>
          <T w="display" style={{ fontSize: 20 }} numberOfLines={1}>
            {allMode ? "Бүх компани" : partner.name}
          </T>
          <T style={{ fontSize: 12, color: C.muted }}>Лизингийн хүсэлтүүд{admin ? " · Админ" : ""}</T>
        </View>
      </View>
      {admin && partners.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip on={allMode} text="Бүгд" onPress={() => pickPartner(ALL)} />
          {partners.map((p) => (
            <Chip key={p.id} on={!allMode && p.id === partner.id} text={p.name} onPress={() => pickPartner(p.id)} />
          ))}
        </ScrollView>
      )}
      {trialDays !== null && (
        <View style={{ backgroundColor: trialDays > 0 ? C.ink : C.dangerBg, borderRadius: 12, padding: 12 }}>
          <T style={{ fontSize: 13, lineHeight: 19, color: trialDays > 0 ? C.paper : "#9B1C1C" }}>
            {trialDays > 0 ? (
              <>
                🎁 Туршилтын хугацаа:{" "}
                <T w="bold" style={{ fontSize: 13, color: C.yellow }}>
                  {trialDays} хоног
                </T>{" "}
                үлдсэн — үнэгүй.
              </>
            ) : (
              "Туршилтын хугацаа дууссан. Үргэлжлүүлэх нөхцөлийг админтай тохирно уу."
            )}
          </T>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Kpi dark label="Шинэ хүсэлт" value={String(count("new"))} onPress={() => pickTab("new")} />
        <Kpi
          label="Энэ сар"
          value={String(month.length)}
          sub={`${num(month.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮ зээл`}
        />
        <Kpi
          label="Зөвшөөрсөн"
          value={String(approved.length)}
          sub={`${num(approved.reduce((t, r) => t + (r.price - r.down_payment), 0))}₮`}
        />
        <Kpi
          label="Хөрвөлт"
          value={decided ? `${Math.round((approved.length / decided) * 100)}%` : "—"}
          sub="Шийдвэрлэснээс"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {tabs.map((t) => (
          <Chip
            key={t.key}
            on={t.key === tab}
            text={`${t.label}${t.key !== "all" && t.key !== "terms" ? ` · ${count(t.key)}` : ""}`}
            onPress={() => pickTab(t.key)}
          />
        ))}
      </ScrollView>
      {tab === "terms" && !allMode && (
        <Terms partner={partner} editable={admin || profile?.partner_id === partner.id} onSaved={loadPartners} />
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={loading || (tab === "terms" && !allMode) ? [] : rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: withBack ? 8 : 12, gap: 10, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              loadPartners();
            }}
            tintColor={C.ink}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          tab === "terms" && !allMode ? null : loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} style={{ height: 170, borderRadius: 14 }} />
              ))}
            </View>
          ) : error ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 30 }}>
              <T style={{ color: C.danger, textAlign: "center" }}>{error}</T>
              <Button
                small
                title="Дахин оролдох"
                icon="refresh-cw"
                onPress={() => {
                  setLoading(true);
                  loadRows();
                }}
              />
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 36 }}>
              <Feather name="inbox" size={32} color={C.pale} />
              <T style={{ color: C.muted }}>Энд хүсэлт алга байна</T>
            </View>
          )
        }
        renderItem={({ item }) => (
          <RequestCard r={item} onDone={loadRows} partnerName={allMode ? partnerName(item.partner_id) : undefined} />
        )}
      />
    </KeyboardAvoidingView>
  );
}
