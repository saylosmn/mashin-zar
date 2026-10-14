import { useState } from "react";
import { View } from "react-native";
import { C } from "@/lib/theme";
import { money, timeAgo } from "@/lib/format";
import { openContract } from "@/lib/staff";
import { Button, Input, T, s } from "@/components/ui";
import { Cell } from "@/components/stats";
import type { Report } from "./types";
import { ST } from "./status";

export function ReportCard({
  r,
  admin,
  onReview,
  onPaid,
}: {
  r: Report;
  admin: boolean;
  onReview: (r: Report, approve: boolean, note: string) => void;
  onPaid: (r: Report, paid: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const st = ST[r.status];
  return (
    <View style={[s.card, { padding: 14, gap: 10 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T w="bold" style={{ fontSize: 15 }}>
            {r.ad ? `${r.ad.brand} ${r.ad.model} · ${r.ad.year_made}` : "Устгагдсан зар"}
          </T>
          <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
            {r.ad?.plate_number ?? ""} · {r.author?.full_name ?? r.author?.email ?? "Админ"} · {timeAgo(r.created_at)}
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Cell k="Зарагдсан үнэ" v={money(r.sold_price)} />
        <Cell k="Хугацаа" v={`${r.days_on_market} хоног`} />
        <Cell k={`Шимтгэл ${Number(r.commission_percent)}%`} v={money(r.commission_amount)} strong />
      </View>
      {r.buyer_name || r.buyer_phone || r.note ? (
        <T style={{ fontSize: 13, color: C.body, lineHeight: 19 }}>
          {r.buyer_name || r.buyer_phone
            ? `Худалдан авагч: ${[r.buyer_name, r.buyer_phone].filter(Boolean).join(", ")}. `
            : ""}
          {r.note ?? ""}
        </T>
      ) : null}
      {r.agent_id ? (
        <View style={{ backgroundColor: C.paper, borderRadius: 8, padding: 8, gap: 6 }}>
          <T style={{ fontSize: 13 }}>
            Агент:{" "}
            <T w="semibold" style={{ fontSize: 13 }}>
              {r.agent?.full_name ?? "—"}
            </T>
            {r.agent?.agent_code ? ` · ${r.agent.agent_code}` : ""} · {money(r.agent_amount ?? 0)}
            {r.status === "approved" ? (r.agent_paid_at ? " · Төлсөн" : " · Төлөөгүй") : ""}
          </T>
          {admin && r.status === "approved" ? (
            <Button
              small
              variant={r.agent_paid_at ? "ghost" : "ink"}
              title={r.agent_paid_at ? "Төлөөгүй болгох" : "Агентад төлсөн гэж тэмдэглэх"}
              onPress={() => onPaid(r, !r.agent_paid_at)}
            />
          ) : null}
        </View>
      ) : null}
      {r.admin_note ? (
        <T style={{ fontSize: 13, backgroundColor: C.paper, padding: 8, borderRadius: 8 }}>Админ: {r.admin_note}</T>
      ) : null}
      {r.ad?.contract_id ? (
        <Button
          small
          title="Гэрээ (PDF)"
          icon="file-text"
          variant="ghost"
          onPress={() => openContract(r.ad!.contract_id!)}
        />
      ) : null}
      {admin && r.status === "pending" && (
        <View style={{ gap: 8 }}>
          <Input value={note} onChangeText={setNote} placeholder="Тэмдэглэл (заавал биш)" style={{ height: 44 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              small
              title="Буцаах"
              icon="x"
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => onReview(r, false, note)}
            />
            <Button
              small
              title="Батлах"
              icon="check"
              variant="yellow"
              style={{ flex: 1 }}
              onPress={() => onReview(r, true, note)}
            />
          </View>
        </View>
      )}
    </View>
  );
}
