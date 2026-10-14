"use client";

import { CITIES } from "@shared/cars";
import { LATIN_RD, digits, hasLatin, moneyInput, type LoanForm, type SetField } from "@shared/loan-form";
import { num } from "@/lib/format";
import { EMPLOYMENT, MARITAL, ageFrom, rdBirthDate, type Check, type Partner } from "@/lib/loan";
import { Chips, Field, Heading, Notice, Row, YesNo } from "./controls";

type StepProps = { form: LoanForm; set: SetField; partner: Partner };

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onValue: (v: string) => void;
  mono?: boolean;
};

function TextInput({ value, onValue, mono, className = "", ...rest }: InputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onValue(e.target.value)}
      className={`input h-11 ${mono ? "mono" : ""} ${className}`}
      {...rest}
    />
  );
}

export function PersonalStep({ form, set }: StepProps) {
  const birth = rdBirthDate(form.rd);
  return (
    <>
      <Heading>Хувийн мэдээлэл</Heading>
      <Row>
        <Field label="Овог нэр">
          <TextInput value={form.fullName} onValue={set("fullName")} autoComplete="name" />
        </Field>
        <Field label="Утас">
          <TextInput mono value={form.phone} onValue={set("phone")} inputMode="tel" autoComplete="tel" />
        </Field>
      </Row>
      <Field
        label="Регистрийн дугаар"
        hint={
          hasLatin(form.rd)
            ? `⚠ ${LATIN_RD}`
            : birth
              ? `Төрсөн: ${birth.toISOString().slice(0, 10)} · ${ageFrom(birth)} нас`
              : "Жишээ: УБ99112233"
        }
      >
        <TextInput
          mono
          value={form.rd}
          onValue={(v) => set("rd")(v.toUpperCase())}
          maxLength={12}
          aria-invalid={!!form.rd && !birth}
        />
      </Field>
      <Row>
        <Field label="Хот / аймаг">
          <select value={form.city} onChange={(e) => set("city")(e.target.value)} className="input h-11">
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Дүүрэг / сум">
          <TextInput value={form.district} onValue={set("district")} placeholder="Сүхбаатар" />
        </Field>
      </Row>
      <Field label="Дэлгэрэнгүй хаяг">
        <TextInput value={form.address} onValue={set("address")} placeholder="Хороо, байр, тоот" />
      </Field>
      <Field label="Гэрлэлтийн байдал" group>
        <Chips value={form.marital} onChange={set("marital")} options={MARITAL} />
      </Field>
      <Row>
        <Field label="Ам бүлийн тоо">
          <TextInput
            mono
            value={form.household}
            onValue={(v) => set("household")(digits(v).slice(0, 2))}
            inputMode="numeric"
          />
        </Field>
        <Field label="Жолооны үнэмлэхтэй юу?" group>
          <YesNo value={form.license} onChange={set("license")} />
        </Field>
      </Row>
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
      <Heading>Ажил, орлого</Heading>
      <Field label="Орлогын үндсэн эх үүсвэр" group>
        <Chips value={form.emp} onChange={set("emp")} options={EMPLOYMENT} />
      </Field>
      {form.emp !== "pension" && form.emp !== "other" && (
        <Row>
          <Field label={business ? "Бизнесийн нэр / төрөл" : "Ажлын газар"}>
            <TextInput value={form.employer} onValue={set("employer")} />
          </Field>
          <Field label="Албан тушаал">
            <TextInput value={form.position} onValue={set("position")} />
          </Field>
        </Row>
      )}
      <Field
        label={business ? "Бизнес эрхэлсэн хугацаа (сар)" : "Одоогийн ажилдаа ажилласан хугацаа (сар)"}
        hint={`Шаардлага: ${minMonths}+ сар`}
      >
        <TextInput mono value={form.work} onValue={(v) => set("work")(digits(v).slice(0, 3))} inputMode="numeric" />
      </Field>
      <Row>
        <Field label="Сарын цэвэр орлого (₮)">
          <TextInput mono value={form.income} onValue={money("income")} inputMode="numeric" />
        </Field>
        <Field label="Бусад орлого (₮, сараар)">
          <TextInput mono value={form.other} onValue={money("other")} inputMode="numeric" placeholder="0" />
        </Field>
      </Row>
      <Field
        label="Одоо төлж буй бусад зээлийн сарын төлбөр (₮)"
        hint="Банк, ББСБ, утасны зээл гэх мэт бүгдийг нийлүүлнэ"
      >
        <TextInput mono value={form.debt} onValue={money("debt")} inputMode="numeric" placeholder="0" />
      </Field>
      <Field label="Хугацаа хэтэрсэн зээл байгаа юу?" group>
        <YesNo value={form.overdue} onChange={set("overdue")} />
      </Field>
      {dti != null && (
        <Notice tone={dti <= maxDti ? "ok" : "warn"}>
          Өр/орлогын харьцаа: <strong>{dti}%</strong> (шаардлага ≤ {maxDti}%)
          {dti > maxDti ? ". Хамтран зээлдэгч нэмэх эсвэл урьдчилгаагаа нэмэгдүүлбэл харьцаа буурна." : ""}
        </Notice>
      )}
    </>
  );
}

export function ContactsStep({ form, set, partner, needCosigner }: StepProps & { needCosigner: boolean }) {
  return (
    <>
      <Heading>Яаралтай үед холбоо барих хүн</Heading>
      <Row>
        <Field label="Нэр">
          <TextInput value={form.refName} onValue={set("refName")} />
        </Field>
        <Field label="Утас">
          <TextInput mono value={form.refPhone} onValue={set("refPhone")} inputMode="tel" />
        </Field>
      </Row>
      <Field label="Таны хэн болох">
        <TextInput value={form.refRel} onValue={set("refRel")} placeholder="Ах, найз, хамт ажилладаг…" />
      </Field>

      <hr className="w-full border-line" />
      <Heading>Хамтран зээлдэгч</Heading>
      {needCosigner && (
        <Notice tone="warn">
          {partner.name} {num(Number(partner.cosigner_over))}₮-өөс дээш зээлд хамтран зээлдэгч шаарддаг.
        </Notice>
      )}
      <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
        <input
          type="checkbox"
          checked={form.hasCos}
          onChange={(e) => set("hasCos")(e.target.checked)}
          className="h-5 w-5 accent-[#111317]"
        />
        Хамтран зээлдэгчтэй (ихэвчлэн гэр бүлийн хүн)
      </label>
      {form.hasCos && (
        <>
          <Row>
            <Field label="Нэр">
              <TextInput value={form.cosName} onValue={set("cosName")} />
            </Field>
            <Field label="Утас">
              <TextInput mono value={form.cosPhone} onValue={set("cosPhone")} inputMode="tel" />
            </Field>
          </Row>
          <Row>
            <Field label="Таны хэн болох">
              <TextInput value={form.cosRel} onValue={set("cosRel")} placeholder="Эхнэр, нөхөр…" />
            </Field>
            <Field label="Регистр (заавал биш)" hint={hasLatin(form.cosRd) ? `⚠ ${LATIN_RD}` : undefined}>
              <TextInput mono value={form.cosRd} onValue={(v) => set("cosRd")(v.toUpperCase())} maxLength={12} />
            </Field>
          </Row>
          <Field label="Хамтран зээлдэгчийн сарын орлого (₮)">
            <TextInput
              mono
              value={form.cosIncome}
              onValue={(v) => set("cosIncome")(moneyInput(v))}
              inputMode="numeric"
            />
          </Field>
        </>
      )}
    </>
  );
}

const CHECK_TONE = {
  ok: { cls: "bg-[#DDF3E4] text-[#1D6B3A]", mark: "✓", sr: "хангаж байна" },
  fail: { cls: "bg-danger-bg text-[#9b1c1c]", mark: "✗", sr: "хангахгүй" },
  na: { cls: "bg-soft text-body", mark: "–", sr: "хамаарахгүй" },
};

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
      <Heading>Шалгаад илгээх</Heading>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {checks.map((c) => {
          const tone = CHECK_TONE[c.ok === true ? "ok" : c.ok === false ? "fail" : "na"];
          return (
            <li
              key={c.key}
              className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-[14px]"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-bold ${tone.cls}`}
                >
                  {tone.mark}
                </span>
                {c.label}
              </span>
              <span className="font-semibold">
                {c.value} <span className="sr-only">{tone.sr}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {failed > 0 && (
        <Notice tone="warn">
          {failed} шаардлагыг хангахгүй байна. Хүсэлтээ илгээж болох ч эцсийн шийдвэрийг {partner.name} гаргана.
        </Notice>
      )}
      {partner.requirements_note && (
        <p className="m-0 rounded-xl border border-line px-4 py-3 text-[13px] text-body">
          {partner.name}: {partner.requirements_note}
        </p>
      )}
      <Field label="Нэмэлт тэмдэглэл (заавал биш)">
        <textarea
          value={form.note}
          onChange={(e) => set("note")(e.target.value)}
          rows={2}
          className="textarea"
          placeholder="Залгах тохиромжтой цаг гэх мэт"
        />
      </Field>
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#111317]"
        />
        <span>
          Энэ анкетын мэдээлэл болон хавсаргасан баримтуудыг <strong>{partner.name}</strong>-д дамжуулж, зээлийн шийдвэр
          гаргах зорилгоор ашиглах, надтай холбогдохыг зөвшөөрч байна. Мэдээлэл үнэн зөв гэдгийг баталж байна.
        </span>
      </label>
    </>
  );
}
