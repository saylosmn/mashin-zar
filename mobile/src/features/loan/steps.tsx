import { View } from "react-native";
import { C } from "@/lib/theme";
import { num } from "@/lib/format";
import { CITIES } from "@shared/cars";
import { EMPLOYMENT, MARITAL, ageFrom, rdBirthDate, type Check, type Partner } from "@/lib/loan";
import { Field, Input, T, s } from "@/components/ui";
import { Checkbox, Chips, Notice, Strong, YesNo } from "./controls";
import { LATIN_RD, digits, hasLatin, moneyInput, type LoanForm, type SetField } from "@shared/loan-form";

type StepProps = { form: LoanForm; set: SetField; partner: Partner };

const cityOptions = Object.fromEntries(CITIES.map((c) => [c, c]));

export function PersonalStep({ form, set }: StepProps) {
  const birth = rdBirthDate(form.rd);
  return (
    <>
      <T w="bold" style={s.h2}>
        Хувийн мэдээлэл
      </T>
      <Field label="Овог нэр">
        <Input value={form.fullName} onChangeText={set("fullName")} autoComplete="name" />
      </Field>
      <Field label="Утас">
        <Input mono value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      </Field>
      <Field
        label="Регистрийн дугаар"
        error={hasLatin(form.rd) ? LATIN_RD : null}
        hint={birth ? `Төрсөн: ${birth.toISOString().slice(0, 10)} · ${ageFrom(birth)} нас` : "Жишээ: УБ99112233"}
      >
        <Input
          mono
          value={form.rd}
          onChangeText={(v) => set("rd")(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={12}
          style={form.rd && !birth ? { borderColor: C.danger } : undefined}
        />
      </Field>
      <Field label="Хот / аймаг">
        <Chips value={form.city} onChange={set("city")} options={cityOptions} />
      </Field>
      <Field label="Дүүрэг / сум">
        <Input value={form.district} onChangeText={set("district")} placeholder="Сүхбаатар" />
      </Field>
      <Field label="Дэлгэрэнгүй хаяг">
        <Input value={form.address} onChangeText={set("address")} placeholder="Хороо, байр, тоот" />
      </Field>
      <Field label="Гэрлэлтийн байдал">
        <Chips value={form.marital} onChange={set("marital")} options={MARITAL} />
      </Field>
      <Field label="Ам бүлийн тоо">
        <Input
          mono
          value={form.household}
          onChangeText={(v) => set("household")(digits(v).slice(0, 2))}
          keyboardType="number-pad"
        />
      </Field>
      <Field label="Жолооны үнэмлэхтэй юу?">
        <YesNo value={form.license} onChange={set("license")} />
      </Field>
    </>
  );
}

export function IncomeStep({ form, set, partner, dti }: StepProps & { dti: number | null }) {
  const business = form.emp === "business";
  const maxDti = Number(partner.max_dti ?? 50);
  const minMonths = business ? (partner.min_business_months ?? 12) : (partner.min_work_months ?? 6);
  const money = (key: "income" | "other" | "debt") => (v: string) => set(key)(moneyInput(v));
  return (
    <>
      <T w="bold" style={s.h2}>
        Ажил, орлого
      </T>
      <Field label="Орлогын үндсэн эх үүсвэр">
        <Chips value={form.emp} onChange={set("emp")} options={EMPLOYMENT} />
      </Field>
      {form.emp !== "pension" && form.emp !== "other" && (
        <>
          <Field label={business ? "Бизнесийн нэр / төрөл" : "Ажлын газар"}>
            <Input value={form.employer} onChangeText={set("employer")} />
          </Field>
          <Field label="Албан тушаал">
            <Input value={form.position} onChangeText={set("position")} />
          </Field>
        </>
      )}
      <Field
        label={business ? "Бизнес эрхэлсэн хугацаа (сар)" : "Одоогийн ажилдаа ажилласан (сар)"}
        hint={`Шаардлага: ${minMonths}+ сар`}
      >
        <Input
          mono
          value={form.work}
          onChangeText={(v) => set("work")(digits(v).slice(0, 3))}
          keyboardType="number-pad"
        />
      </Field>
      <Field label="Сарын цэвэр орлого (₮)">
        <Input mono value={form.income} onChangeText={money("income")} keyboardType="number-pad" />
      </Field>
      <Field label="Бусад орлого (₮, сараар)">
        <Input mono value={form.other} onChangeText={money("other")} keyboardType="number-pad" placeholder="0" />
      </Field>
      <Field label="Бусад зээлийн сарын төлбөр (₮)" hint="Банк, ББСБ, утасны зээл бүгдийг нийлүүлнэ">
        <Input mono value={form.debt} onChangeText={money("debt")} keyboardType="number-pad" placeholder="0" />
      </Field>
      <Field label="Хугацаа хэтэрсэн зээл байгаа юу?">
        <YesNo value={form.overdue} onChange={set("overdue")} />
      </Field>
      {dti != null && (
        <Notice tone={dti <= maxDti ? "ok" : "warn"}>
          Өр/орлогын харьцаа: <Strong>{dti}%</Strong> (шаардлага ≤ {maxDti}%)
          {dti > maxDti ? ". Хамтран зээлдэгч эсвэл илүү урьдчилгаа нэмбэл буурна." : ""}
        </Notice>
      )}
    </>
  );
}

export function ContactsStep({ form, set, partner, needCosigner }: StepProps & { needCosigner: boolean }) {
  return (
    <>
      <T w="bold" style={s.h2}>
        Яаралтай үед холбоо барих хүн
      </T>
      <Field label="Нэр">
        <Input value={form.refName} onChangeText={set("refName")} />
      </Field>
      <Field label="Утас">
        <Input mono value={form.refPhone} onChangeText={set("refPhone")} keyboardType="phone-pad" />
      </Field>
      <Field label="Таны хэн болох">
        <Input value={form.refRel} onChangeText={set("refRel")} placeholder="Ах, найз, хамт ажилладаг…" />
      </Field>

      <View style={{ height: 1, backgroundColor: C.line }} />
      <T w="bold" style={s.h2}>
        Хамтран зээлдэгч
      </T>
      {needCosigner && (
        <Notice tone="warn">
          {partner.name} {num(Number(partner.cosigner_over))}₮-өөс дээш зээлд хамтран зээлдэгч шаарддаг.
        </Notice>
      )}
      <Checkbox checked={form.hasCos} onChange={set("hasCos")}>
        <T style={{ fontSize: 14 }}>Хамтран зээлдэгчтэй (ихэвчлэн гэр бүлийн хүн)</T>
      </Checkbox>
      {form.hasCos && (
        <>
          <Field label="Нэр">
            <Input value={form.cosName} onChangeText={set("cosName")} />
          </Field>
          <Field label="Утас">
            <Input mono value={form.cosPhone} onChangeText={set("cosPhone")} keyboardType="phone-pad" />
          </Field>
          <Field label="Таны хэн болох">
            <Input value={form.cosRel} onChangeText={set("cosRel")} placeholder="Эхнэр, нөхөр…" />
          </Field>
          <Field label="Регистр (заавал биш)" error={hasLatin(form.cosRd) ? LATIN_RD : null}>
            <Input
              mono
              value={form.cosRd}
              onChangeText={(v) => set("cosRd")(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
            />
          </Field>
          <Field label="Хамтран зээлдэгчийн сарын орлого (₮)">
            <Input
              mono
              value={form.cosIncome}
              onChangeText={(v) => set("cosIncome")(moneyInput(v))}
              keyboardType="number-pad"
            />
          </Field>
        </>
      )}
    </>
  );
}

function CheckRow({ check }: { check: Check }) {
  const tone =
    check.ok === true
      ? { bg: "#DDF3E4", fg: "#1D6B3A", mark: "✓" }
      : check.ok === false
        ? { bg: C.dangerBg, fg: "#9B1C1C", mark: "✗" }
        : { bg: C.soft, fg: C.body, mark: "–" };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: C.paper,
        borderRadius: 10,
        padding: 10,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tone.bg,
        }}
      >
        <T w="bold" style={{ fontSize: 13, color: tone.fg }}>
          {tone.mark}
        </T>
      </View>
      <T style={{ fontSize: 13, flex: 1 }}>{check.label}</T>
      <T w="semibold" style={{ fontSize: 13 }}>
        {check.value}
      </T>
    </View>
  );
}

export function ReviewStep({
  form,
  set,
  partner,
  checks,
  consent,
  onConsent,
}: StepProps & { checks: Check[]; consent: boolean; onConsent: (v: boolean) => void }) {
  const failed = checks.filter((c) => c.ok === false).length;
  return (
    <>
      <T w="bold" style={s.h2}>
        Шалгаад илгээх
      </T>
      {checks.map((c) => (
        <CheckRow key={c.key} check={c} />
      ))}
      {failed > 0 && (
        <Notice tone="warn">
          {failed} шаардлагыг хангахгүй байна. Хүсэлтээ илгээж болох ч эцсийн шийдвэрийг {partner.name} гаргана.
        </Notice>
      )}
      {partner.requirements_note ? (
        <T style={{ fontSize: 13, color: C.body, lineHeight: 19 }}>
          {partner.name}: {partner.requirements_note}
        </T>
      ) : null}
      <Field label="Нэмэлт тэмдэглэл (заавал биш)">
        <Input
          value={form.note}
          onChangeText={set("note")}
          multiline
          style={{ minHeight: 70 }}
          placeholder="Залгах тохиромжтой цаг гэх мэт"
        />
      </Field>
      <Checkbox checked={consent} onChange={onConsent}>
        <T style={{ fontSize: 13, lineHeight: 19 }}>
          Энэ анкетын мэдээлэл, хавсаргасан баримтуудыг <Strong>{partner.name}</Strong>-д дамжуулж, зээлийн шийдвэр
          гаргахад ашиглах, надтай холбогдохыг зөвшөөрч байна. Мэдээлэл үнэн зөв гэдгийг баталж байна.
        </T>
      </Checkbox>
    </>
  );
}
