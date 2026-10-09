import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { INCOME_OPTIONS, fmtNum, minDown, monthlyPayment, termOptions, type Partner } from "@/lib/loan";
import { Button, Field, Input, T } from "./ui";

/** Зарын дэлгэц дээрх лизингийн тооцоолуур + "Лизингээр авах" хүсэлт (вэбийн LoanCalculator-тай ижил) */
export function LoanCalculator({ adId, price, partners, defaultName, defaultPhone }: { adId: string; price: number; partners: Partner[]; defaultName: string; defaultPhone: string }) {
  const [pid, setPid] = useState(partners[0].id);
  const p = partners.find((x) => x.id === pid) ?? partners[0];
  const [down, setDown] = useState(() => fmtNum(minDown(price, p.min_down_pct)));
  const terms = termOptions(p.max_term_months);
  const [term, setTerm] = useState(() => (terms.includes(24) ? 24 : terms[terms.length - 1]));
  const [form, setForm] = useState(false);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [income, setIncome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  async function send() {
    setError(null);
    if (downErr) return setError(downErr);
    if (!name.trim()) return setError("Нэрээ оруулна уу");
    if (phone.replace(/\D/g, "").length < 8) return setError("Утасны дугаараа зөв оруулна уу");
    if (!consent) return setError("Мэдээллээ лизингийн компанид дамжуулахыг зөвшөөрнө үү");
    setBusy(true);
    const { error: e } = await supabase.rpc("submit_loan_request", {
      p_ad: adId, p_partner: p.id, p_full_name: name.trim(), p_phone: phone.trim(), p_down: downNum, p_term: term,
      p_income: income, p_note: note.trim() || null, p_consent: consent,
    });
    setBusy(false);
    if (e) return setError(errMsg(e));
    setDone(true);
  }

  if (done)
    return (
      <View style={{ backgroundColor: C.ink, borderRadius: 16, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.yellow, alignItems: "center", justifyContent: "center" }}>
            <Feather name="check" size={18} color={C.ink} />
          </View>
          <T w="bold" style={{ color: C.paper, fontSize: 16 }}>Хүсэлт илгээгдлээ</T>
        </View>
        <T style={{ color: C.pale, fontSize: 14, lineHeight: 20 }}>{p.name} тантай удахгүй холбогдоно. Явцыг “Лизингийн хүсэлтүүд” хэсгээс харна.</T>
        <Button small title="Лизингийн хүсэлтүүд" icon="arrow-right" variant="yellow" onPress={() => router.push("/loans")} />
      </View>
    );

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

      {!form ? (
        <Button title="Лизингийн хүсэлт илгээх" icon="send" variant="yellow" disabled={!!downErr} onPress={() => setForm(true)} />
      ) : (
        <View style={{ gap: 12, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 }}>
          <Field label="Овог нэр"><Input value={name} onChangeText={setName} autoComplete="name" /></Field>
          <Field label="Утас"><Input mono value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
          <Field label="Сарын орлого (заавал биш)">
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {INCOME_OPTIONS.map((o) => <Chip key={o} small on={income === o} text={o} onPress={() => setIncome(income === o ? null : o)} />)}
            </View>
          </Field>
          <Field label="Тэмдэглэл (заавал биш)"><Input value={note} onChangeText={setNote} placeholder="Залгах цаг гэх мэт" multiline style={{ minHeight: 70 }} /></Field>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent(!consent)}
            style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
          >
            <Feather name={consent ? "check-square" : "square"} size={22} color={C.ink} />
            <T style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
              Миний нэр, утас болон энэ хүсэлтийн мэдээллийг <T w="bold" style={{ fontSize: 13 }}>{p.name}</T>-д дамжуулж, надтай холбогдохыг зөвшөөрч байна.
            </T>
          </Pressable>
          {error ? (
            <View style={{ backgroundColor: C.dangerBg, borderRadius: 10, padding: 10 }}>
              <T style={{ color: "#9B1C1C", fontSize: 13 }}>{error}</T>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Болих" variant="ghost" disabled={busy} style={{ flex: 1 }} onPress={() => { setForm(false); setError(null); }} />
            <Button title="Илгээх" icon="send" variant="yellow" loading={busy} disabled={!consent} style={{ flex: 2 }} onPress={send} />
          </View>
        </View>
      )}
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
