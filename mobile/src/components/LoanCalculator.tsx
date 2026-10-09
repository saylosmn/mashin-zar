import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import { DEFAULT_REQUIRED_DOCS, docLabel, fmtNum, minDown, monthlyPayment, requirementLines, termOptions, type Partner } from "@/lib/loan";
import { Button, Field, Input, T } from "./ui";

/** Зарын дэлгэц дээрх лизингийн тооцоолуур + "Лизингээр авах" хүсэлт (вэбийн LoanCalculator-тай ижил) */
export function LoanCalculator({ adId, price, partners }: { adId: string; price: number; partners: Partner[] }) {
  const [pid, setPid] = useState(partners[0].id);
  const p = partners.find((x) => x.id === pid) ?? partners[0];
  const [down, setDown] = useState(() => fmtNum(minDown(price, p.min_down_pct)));
  const terms = termOptions(p.max_term_months);
  const [term, setTerm] = useState(() => (terms.includes(24) ? 24 : terms[terms.length - 1]));
  const [showReq, setShowReq] = useState(false);

  const downNum = Number(down.replace(/\D/g, "")) || 0;
  const min = minDown(price, p.min_down_pct);
  const principal = Math.max(0, price - downNum);
  const monthly = useMemo(() => monthlyPayment(principal, Number(p.rate_annual), term), [principal, p.rate_annual, term]);
  const downErr = downNum < min ? `Урьдчилгаа хамгийн багадаа ${fmtNum(min)}₮ (${Number(p.min_down_pct)}%)` : downNum >= price ? "Урьдчилгаа үнээс бага байх ёстой" : null;
  const pctChips = [Number(p.min_down_pct), 40, 50, 60].filter((v, i, a) => v < 90 && v >= Number(p.min_down_pct) && a.indexOf(v) === i);

  function pickPartner(id: string) {
    const np = partners.find((x) => x.id === id)!;
    setPid(id);
    const nm = minDown(price, np.min_down_pct);
    if (downNum < nm) setDown(fmtNum(nm));
    const t = termOptions(np.max_term_months);
    if (!t.includes(term)) setTerm(t[t.length - 1]);
  }

  return (
    <View style={{ borderWidth: 2, borderColor: C.ink, borderRadius: 16, padding: 16, gap: 14, backgroundColor: C.card }}>
      <View style={{ gap: 2 }}>
        <T w="bold" style={{ fontSize: 17 }}>Лизингээр авах</T>
        <T style={{ fontSize: 12, color: C.muted }}>{p.name} · жилийн {Number(p.rate_annual)}% · {p.max_term_months} сар хүртэл</T>
      </View>

      {partners.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {partners.map((x) => (
            <Chip key={x.id} on={x.id === pid} text={`${x.name} · ${Number(x.rate_annual)}%`} onPress={() => pickPartner(x.id)} />
          ))}
        </ScrollView>
      )}

      <Field label="Урьдчилгаа (₮)">
        <Input
          mono
          keyboardType="number-pad"
          value={down}
          onChangeText={(t) => { const d = t.replace(/\D/g, ""); setDown(d ? fmtNum(Number(d)) : ""); }}
          style={downErr ? { borderColor: C.danger } : undefined}
        />
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {pctChips.map((pc) => {
            const v = minDown(price, pc);
            return <Chip key={pc} small on={downNum === v} text={`${pc}%`} onPress={() => setDown(fmtNum(v))} />;
          })}
        </View>
        {downErr ? <T style={{ fontSize: 12, color: C.danger }}>{downErr}</T> : null}
      </Field>

      <Field label="Хугацаа">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {terms.map((t) => <Chip key={t} small on={t === term} text={`${t} сар`} onPress={() => setTerm(t)} />)}
        </ScrollView>
      </Field>

      <View style={{ backgroundColor: C.paper, borderRadius: 12, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: C.muted }}>Зээлийн дүн</T>
            <T w="bold" style={{ fontSize: 15 }}>{fmtNum(principal)}₮</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: C.muted }}>Нийт төлөх</T>
            <T w="bold" style={{ fontSize: 15 }}>{fmtNum(monthly * term + downNum)}₮</T>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.line, paddingTop: 10 }}>
          <T style={{ fontSize: 13, color: C.muted }}>Сарын төлбөр</T>
          <T w="display" style={{ fontSize: 22 }}>{fmtNum(monthly)}₮</T>
        </View>
      </View>
      <T style={{ fontSize: 11, color: C.muted, marginTop: -6 }}>Урьдчилсан тооцоо. Эцсийн нөхцөлийг лизингийн компани тогтооно.</T>

      <Pressable onPress={() => setShowReq(!showReq)} accessibilityRole="button" accessibilityState={{ expanded: showReq }} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <T w="semibold" style={{ fontSize: 13, flex: 1 }}>{p.name}-ийн шаардлага, баримт</T>
          <Feather name={showReq ? "chevron-up" : "chevron-down"} size={18} color={C.ink} />
        </View>
        {showReq && (
          <View style={{ gap: 4 }}>
            {requirementLines(p).map((l) => <T key={l} style={{ fontSize: 13, color: C.body, lineHeight: 19 }}>• {l}</T>)}
            <T style={{ fontSize: 13, color: C.body, lineHeight: 19, marginTop: 4 }}>
              <T w="semibold" style={{ fontSize: 13 }}>Баримт: </T>{(p.required_docs ?? DEFAULT_REQUIRED_DOCS).map(docLabel).join(", ") || "заавал хавсаргах баримтгүй"}
            </T>
            {p.requirements_note ? <T style={{ fontSize: 13, color: C.body, lineHeight: 19 }}>{p.requirements_note}</T> : null}
          </View>
        )}
      </Pressable>
      <Button
        title="Лизингийн хүсэлт илгээх"
        icon="arrow-right"
        variant="yellow"
        disabled={!!downErr}
        onPress={() => router.push({ pathname: "/loan/[id]", params: { id: adId, partner: p.id, down: String(downNum), term: String(term) } })}
      />
      <T style={{ fontSize: 12, color: C.muted, marginTop: -6 }}>Дараагийн алхамд анкет бөглөж, баримтаа хавсаргана (5–10 минут).</T>
    </View>
  );
}

function Chip({ text, on, onPress, small }: { text: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ height: small ? 34 : 38, paddingHorizontal: small ? 12 : 14, borderRadius: 18, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, justifyContent: "center" }}
    >
      <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>{text}</T>
    </Pressable>
  );
}
