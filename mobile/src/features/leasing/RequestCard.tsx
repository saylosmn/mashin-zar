import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";
import { errMsg, num, timeAgo } from "@/lib/format";
import { confirm, staffRpc } from "@/lib/staff";
import { EMPLOYMENT, LOAN_STATUS, MARITAL, docLabel, sortDocKeys, type LoanRequest, type LoanStatus } from "@/lib/loan";
import { Button, Input, Skeleton, T, s } from "@/components/ui";
import { Cell } from "@/components/stats";

type LoanEvent = {
  id: number | string;
  request_id: string;
  actor_id: string | null;
  actor_name: string | null;
  kind: "submitted" | "status" | "doc_view" | "cancelled";
  detail: string | null;
  created_at: string;
};

/** Баримтын түлхүүрүүдийг LOAN_DOCS-ийн дараалал, хуудсаар эрэмбэлнэ */
export function RequestCard({ r, onDone, partnerName }: { r: LoanRequest; onDone: () => void; partnerName?: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const st = LOAN_STATUS[r.status];

  async function setStatus(status: LoanStatus) {
    if (status === "approved" || status === "rejected") {
      const ok = await confirm(
        status === "approved" ? "Хүсэлтийг зөвшөөрөх үү?" : "Хүсэлтээс татгалзах уу?",
        `${r.full_name} · ${r.car}\n\nХудалдан авагчид ${status === "approved" ? "зөвшөөрсөн" : "татгалзсан"} тухай мэдэгдэл очно.`,
        status === "approved" ? "Зөвшөөрөх" : "Татгалзах",
        status === "rejected",
      );
      if (!ok) return;
    }
    setBusy(status);
    const res = await staffRpc("update_loan_request", { p_id: r.id, p_status: status, p_note: note.trim() || null });
    setBusy(null);
    if (res.ok) {
      setNote("");
      onDone();
    }
  }

  return (
    <View style={[s.card, { padding: 14, gap: 10 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T w="bold" style={{ fontSize: 16 }}>
            {r.full_name}
          </T>
          {partnerName ? (
            <T w="semibold" style={{ fontSize: 12, color: C.ink }} numberOfLines={1}>
              🏦 {partnerName}
            </T>
          ) : null}
          <T style={{ fontSize: 12, color: C.muted }}>
            {timeAgo(r.created_at)}
            {r.income ? ` · Орлого: ${r.income}` : ""}
          </T>
        </View>
        <View
          style={{
            backgroundColor: st.bg,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            alignSelf: "flex-start",
          }}
        >
          <T w="semibold" style={{ fontSize: 11, color: st.fg }}>
            {st.label}
          </T>
        </View>
      </View>
      <Pressable
        disabled={!r.ad_id}
        onPress={() => r.ad_id && router.push(`/ads/${r.ad_id}`)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Feather name="truck" size={15} color={C.ink} />
        <T w="semibold" style={{ fontSize: 14, textDecorationLine: r.ad_id ? "underline" : "none" }}>
          {r.car}
        </T>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Cell k="Машины үнэ" v={`${num(r.price)}₮`} />
        <Cell k="Урьдчилгаа" v={`${num(r.down_payment)}₮`} />
        <Cell k="Зээлийн дүн" v={`${num(r.price - r.down_payment)}₮`} />
        <Cell k="Хугацаа" v={`${r.term_months} сар · ${Number(r.rate_annual)}%`} />
        <Cell k="Сарын төлбөр" v={`${num(r.monthly_payment)}₮`} strong />
      </View>
      {r.checks && r.checks.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {r.checks.map((c) => (
            <View
              key={c.key}
              style={{
                backgroundColor: c.ok === true ? "#DDF3E4" : c.ok === false ? C.dangerBg : C.soft,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <T
                w="semibold"
                style={{ fontSize: 11, color: c.ok === true ? "#1D6B3A" : c.ok === false ? "#9B1C1C" : C.body }}
              >
                {c.ok === true ? "✓" : c.ok === false ? "✗" : "–"} {c.label}: {c.value}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      <ApplicantDetails r={r} />
      {r.docs && Object.keys(r.docs).length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {sortDocKeys(Object.keys(r.docs)).map((k) => (
            <DocChip key={k} requestId={r.id} docKey={k} />
          ))}
        </View>
      ) : null}
      {r.note ? <T style={{ fontSize: 13, color: C.body }}>Худалдан авагч: {r.note}</T> : null}
      {r.partner_note ? (
        <T style={{ fontSize: 13, backgroundColor: C.paper, padding: 8, borderRadius: 8 }}>
          Тэмдэглэл: {r.partner_note}
        </T>
      ) : null}
      <Button
        small
        title={r.phone}
        icon="phone"
        variant="yellow"
        onPress={() => Linking.openURL(`tel:${r.phone.replace(/\s/g, "")}`)}
      />
      {r.status === "cancelled" ? (
        <T style={{ fontSize: 13, color: C.muted }}>Худалдан авагч хүсэлтээ цуцалсан.</T>
      ) : (
        <View style={{ gap: 8 }}>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder="Тэмдэглэл (худалдан авагчид харагдана)"
            style={{ height: 44 }}
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            {r.status !== "contacted" && (
              <Button
                small
                title="Холбогдсон"
                variant="ghost"
                loading={busy === "contacted"}
                disabled={!!busy}
                style={{ flex: 1 }}
                onPress={() => setStatus("contacted")}
              />
            )}
            {r.status !== "approved" && (
              <Button
                small
                title="Зөвшөөрөх"
                variant="ink"
                loading={busy === "approved"}
                disabled={!!busy}
                style={{ flex: 1 }}
                onPress={() => setStatus("approved")}
              />
            )}
            {r.status !== "rejected" && (
              <Button
                small
                title="Татгалзах"
                variant="danger"
                loading={busy === "rejected"}
                disabled={!!busy}
                style={{ flex: 1 }}
                onPress={() => setStatus("rejected")}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/** Баримтыг нээнэ: loan_doc_open RPC эрхийг шалгаж, хэн нээснийг бүртгээд замыг буцаана -> 2 минутын түр холбоос */
async function openDoc(requestId: string, key: string) {
  try {
    const { data: path, error } = await supabase.rpc("loan_doc_open", { p_request: requestId, p_key: key });
    if (error) throw error;
    if (!path || typeof path !== "string") throw new Error("Файл олдсонгүй");
    const { data, error: e2 } = await supabase.storage.from("loan-docs").createSignedUrl(path, 120);
    if (e2) throw e2;
    if (!data?.signedUrl) throw new Error("Файл олдсонгүй");
    await WebBrowser.openBrowserAsync(data.signedUrl, { toolbarColor: "#111317", controlsColor: "#F5B800" });
  } catch (e) {
    Alert.alert("Нээж чадсангүй", errMsg(e));
  }
}

function DocChip({ requestId, docKey }: { requestId: string; docKey: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${docLabel(docKey)} нээх`}
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        await openDoc(requestId, docKey);
        setBusy(false);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: C.line2,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        maxWidth: "100%",
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Feather name={busy ? "loader" : "paperclip"} size={12} color={C.ink} />
      <T style={{ fontSize: 12, flexShrink: 1 }}>{docLabel(docKey)}</T>
    </Pressable>
  );
}

function eventText(e: LoanEvent) {
  switch (e.kind) {
    case "submitted":
      return "Хүсэлт илгээсэн";
    case "status":
      return `Төлөв: ${e.detail ? (LOAN_STATUS[e.detail as LoanStatus]?.label ?? e.detail) : "—"}`;
    case "doc_view":
      return `Баримт нээсэн: ${e.detail ? docLabel(e.detail) : "—"}`;
    case "cancelled":
      return "Цуцалсан";
    default:
      return e.detail ?? String(e.kind);
  }
}

/** Хүсэлтийн түүх (хэн, хэзээ, юу хийсэн) - зөвхөн админ, тухайн компанийн ажилтанд RLS зөвшөөрнө */
function History({ requestId, version }: { requestId: string; version: string }) {
  const [events, setEvents] = useState<LoanEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase
      .from("loan_events")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setErr(errMsg(error));
        else {
          setErr(null);
          setEvents((data ?? []) as LoanEvent[]);
        }
      });
    return () => {
      alive = false;
    };
  }, [requestId, version]);
  return (
    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
      <T w="semibold" style={{ fontSize: 13 }}>
        Түүх
      </T>
      {err ? (
        <T style={{ fontSize: 12, color: C.danger }}>{err}</T>
      ) : !events ? (
        <Skeleton style={{ height: 36, borderRadius: 8 }} />
      ) : events.length === 0 ? (
        <T style={{ fontSize: 12, color: C.muted }}>Бүртгэл алга</T>
      ) : (
        events.map((e) => (
          <View key={String(e.id)} style={{ flexDirection: "row", gap: 10 }}>
            <T style={{ fontSize: 12, color: C.muted, width: 80 }} numberOfLines={1}>
              {timeAgo(e.created_at)}
            </T>
            <T style={{ fontSize: 12, flex: 1 }}>
              <T w="semibold" style={{ fontSize: 12 }}>
                {e.actor_name || "Систем"}
              </T>{" "}
              — {eventText(e)}
            </T>
          </View>
        ))
      )}
    </View>
  );
}

function ApplicantDetails({ r }: { r: LoanRequest }) {
  const [open, setOpen] = useState(false);
  const a = r.applicant ?? {};
  const hasApplicant = Object.keys(a).length > 0;
  const m = (n?: number) => (n == null ? "—" : `${num(n)}₮`);
  const rows: [string, string][] = [
    ["Регистр", `${a.register_no ?? "—"}${a.age != null ? ` · ${a.age} нас` : ""}`],
    ["Хаяг", [a.city, a.district, a.address].filter(Boolean).join(", ") || "—"],
    [
      "Гэр бүл",
      `${a.marital_status ? (MARITAL[a.marital_status] ?? a.marital_status) : "—"} · ам бүл ${a.household_size ?? "—"}`,
    ],
    ["Орлогын эх үүсвэр", a.employment_type ? (EMPLOYMENT[a.employment_type] ?? a.employment_type) : "—"],
    ["Ажлын газар", [a.employer, a.position].filter(Boolean).join(" · ") || "—"],
    ["Ажилласан", a.work_months != null ? `${a.work_months} сар` : "—"],
    ["Сарын орлого", m(a.monthly_income)],
    ["Бусад орлого", m(a.other_income)],
    ["Бусад зээлийн төлбөр", m(a.existing_debt_payment)],
    ["Өр/орлогын харьцаа", r.dti != null ? `${Number(r.dti)}%` : "—"],
    ["Хугацаа хэтэрсэн зээл", a.has_overdue == null ? "—" : a.has_overdue ? "Байгаа" : "Байхгүй"],
    ["Жолооны үнэмлэх", a.has_license == null ? "—" : a.has_license ? "Байгаа" : "Байхгүй"],
    [
      "Холбоо барих хүн",
      a.ref_name ? `${a.ref_name}${a.ref_relation ? ` (${a.ref_relation})` : ""} · ${a.ref_phone ?? ""}` : "—",
    ],
  ];
  if (a.cosigner)
    rows.push([
      "Хамтран зээлдэгч",
      `${a.cosigner.name}${a.cosigner.relation ? ` (${a.cosigner.relation})` : ""} · ${a.cosigner.phone}${a.cosigner.register_no ? ` · ${a.cosigner.register_no}` : ""} · орлого ${m(a.cosigner.monthly_income)}`,
    ]);
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 }}
      >
        <T w="semibold" style={{ fontSize: 13 }}>
          {hasApplicant ? "Анкет, түүх харах" : "Түүх харах"}
        </T>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.ink} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
          {hasApplicant &&
            rows.map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", gap: 10 }}>
                <T style={{ fontSize: 12, color: C.muted, width: 120 }}>{k}</T>
                <T w="medium" style={{ fontSize: 12, flex: 1 }}>
                  {v}
                </T>
              </View>
            ))}
          <History requestId={r.id} version={r.updated_at} />
        </View>
      )}
    </View>
  );
}
