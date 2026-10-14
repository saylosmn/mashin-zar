import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import { num } from "@/lib/format";
import { staffRpc } from "@/lib/staff";
import { DEFAULT_REQUIRED_DOCS, LOAN_DOCS, docLabel, requirementLines, type Partner } from "@/lib/loan";
import { Button, Field, Input, T, s } from "@/components/ui";

type TermsForm = Record<
  | "rate"
  | "min_down"
  | "max_term"
  | "min_age"
  | "max_age"
  | "min_work"
  | "min_business"
  | "max_dti"
  | "min_car_year"
  | "cosigner_over"
  | "note",
  string
>;

const termsFrom = (p: Partner): TermsForm => ({
  rate: String(Number(p.rate_annual)),
  min_down: String(Number(p.min_down_pct)),
  max_term: String(p.max_term_months),
  min_age: String(p.min_age ?? 18),
  max_age: String(p.max_age ?? 65),
  min_work: String(p.min_work_months ?? 6),
  min_business: String(p.min_business_months ?? 12),
  max_dti: String(Number(p.max_dti ?? 50)),
  min_car_year: p.min_car_year ? String(p.min_car_year) : "",
  cosigner_over: p.cosigner_over != null ? num(Number(p.cosigner_over)) : "",
  note: p.requirements_note ?? "",
});

export function Terms({ partner, editable, onSaved }: { partner: Partner; editable: boolean; onSaved: () => void }) {
  const [f, setF] = useState<TermsForm>(() => termsFrom(partner));
  const [docs, setDocs] = useState<string[]>(partner.required_docs ?? DEFAULT_REQUIRED_DOCS);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof TermsForm) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  // Зөвхөн өөр түнш сонгогдох эсвэл хадгалагдсан үед (updated_at өөрчлөгдөхөд) формыг шинэчилнэ -
  // live шинэчлэлтээр шинэ объект ирэхэд бичиж буй утгыг арилгахгүй.
  const partnerRef = useRef(partner);
  partnerRef.current = partner;
  useEffect(() => {
    const p = partnerRef.current;
    setF(termsFrom(p));
    setDocs(p.required_docs ?? DEFAULT_REQUIRED_DOCS);
  }, [partner.id, partner.updated_at]);

  async function save() {
    setSaved(false);
    const need: (keyof TermsForm)[] = [
      "rate",
      "min_down",
      "max_term",
      "min_age",
      "max_age",
      "min_work",
      "min_business",
      "max_dti",
    ];
    if (need.some((k) => !f[k].trim() || !Number.isFinite(Number(f[k].replace(",", ".")))))
      return Alert.alert("Буруу утга", "Тоон талбаруудыг зөв бөглөнө үү.");
    setBusy(true);
    const n = (k: keyof TermsForm) => f[k].replace(",", ".").trim();
    const res = await staffRpc("set_partner_terms", {
      p_partner: partner.id,
      p: {
        rate_annual: n("rate"),
        min_down_pct: n("min_down"),
        max_term_months: n("max_term"),
        min_age: n("min_age"),
        max_age: n("max_age"),
        min_work_months: n("min_work"),
        min_business_months: n("min_business"),
        max_dti: n("max_dti"),
        min_car_year: n("min_car_year"),
        cosigner_over: f.cosigner_over.replace(/\D/g, ""),
        required_docs: docs,
        requirements_note: f.note,
      },
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      onSaved();
    }
  }

  if (!editable)
    return (
      <View style={[s.section]}>
        <T w="bold" style={s.h2}>
          Нөхцөл ба шаардлага
        </T>
        {requirementLines(partner).map((l) => (
          <T key={l} style={{ fontSize: 13, color: C.body }}>
            • {l}
          </T>
        ))}
        <T style={{ fontSize: 13, color: C.body }}>
          • Баримт:{" "}
          {(partner.required_docs ?? DEFAULT_REQUIRED_DOCS).map(docLabel).join(", ") || "заавал хавсаргах баримтгүй"}
        </T>
      </View>
    );

  const numField = (k: keyof TermsForm, label: string, decimal = false, placeholder?: string) => (
    <View style={{ flexBasis: "47%", flexGrow: 1 }}>
      <Field label={label}>
        <Input
          mono
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          value={f[k]}
          onChangeText={set(k)}
          placeholder={placeholder}
        />
      </Field>
    </View>
  );

  return (
    <View style={[s.section]}>
      <T w="bold" style={s.h2}>
        Нөхцөл ба шаардлага
      </T>
      <T style={{ fontSize: 13, color: C.muted, lineHeight: 19 }}>
        Тооцоолуур, хүсэлтийн анкет энэ тохиргоог ашиглана. Хүсэлт бүрийг систем шаардлагатай тулгаж ✓/✗ гэж харуулна.
      </T>
      <T w="semibold" style={{ fontSize: 14 }}>
        Зээлийн нөхцөл
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {numField("rate", "Жилийн хүү (%)", true)}
        {numField("min_down", "Мин урьдчилгаа (%)", true)}
        {numField("max_term", "Макс хугацаа (сар)")}
      </View>
      <T w="semibold" style={{ fontSize: 14 }}>
        Зээлдэгчид тавих шаардлага
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {numField("min_age", "Доод нас")}
        {numField("max_age", "Дээд нас")}
        {numField("min_work", "Ажилласан (сар)")}
        {numField("min_business", "Бизнес (сар)")}
        {numField("max_dti", "Өр/орлого ≤ (%)", true)}
        {numField("min_car_year", "Машины он ≥", false, "Хязгааргүй")}
      </View>
      <Field label="Хамтран зээлдэгч шаардах зээл (₮-өөс дээш)">
        <Input
          mono
          keyboardType="number-pad"
          value={f.cosigner_over}
          onChangeText={(v) => set("cosigner_over")(v.replace(/\D/g, "") ? num(Number(v.replace(/\D/g, ""))) : "")}
          placeholder="Шаардахгүй"
        />
      </Field>
      <T w="semibold" style={{ fontSize: 14 }}>
        Заавал хавсаргах баримт
      </T>
      <View style={{ gap: 6 }}>
        {LOAN_DOCS.map((d) => {
          const on = docs.includes(d.kind);
          return (
            <Pressable
              key={d.kind}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => setDocs((x) => (on ? x.filter((k) => k !== d.kind) : [...x, d.kind]))}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: C.paper,
                borderRadius: 10,
                padding: 10,
              }}
            >
              <Feather name={on ? "check-square" : "square"} size={20} color={C.ink} />
              <T style={{ fontSize: 13, flex: 1 }}>{d.label}</T>
            </Pressable>
          );
        })}
      </View>
      <Field label="Нэмэлт шаардлага (худалдан авагчид харагдана)">
        <Input
          value={f.note}
          onChangeText={set("note")}
          multiline
          style={{ minHeight: 80 }}
          placeholder="Жишээ: 100% даатгал заавал"
        />
      </Field>
      {saved ? <T style={{ fontSize: 13, color: C.activeFg }}>✓ Хадгалагдлаа</T> : null}
      <Button title="Хадгалах" icon="check" loading={busy} onPress={save} />
    </View>
  );
}
