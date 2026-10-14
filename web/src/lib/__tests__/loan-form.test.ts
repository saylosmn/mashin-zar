import { describe, expect, it } from "vitest";
import { applicantPayload, emptyForm, fromApplicant, packDocs, validateStep, type LoanForm } from "@shared/loan-form";
import { sortDocKeys } from "@shared/loan";

const valid: LoanForm = {
  ...emptyForm({ full_name: "Бат Болд", phone: "99112233", city: "Улаанбаатар" }),
  rd: "УБ99112233",
  address: "3-р хороо",
  marital: "married",
  household: "4",
  emp: "salary",
  employer: "Хаан банк",
  work: "24",
  income: "2,500,000",
  overdue: false,
  refName: "Дорж",
  refPhone: "88112233",
};

describe("лизингийн анкет", () => {
  it("бүрэн бөглөсөн анкет алхам бүрт давна", () => {
    for (const step of [0, 1, 2]) expect(validateStep(step, valid, [], {})).toBeNull();
  });

  it("регистрт латин үсэг бичвэл анхааруулна", () => {
    expect(validateStep(0, { ...valid, rd: "UB99112233" }, [], {})).toMatch(/кирилл/);
  });

  it("цалинтай бол ажлын газар заавал", () => {
    expect(validateStep(1, { ...valid, employer: " " }, [], {})).toMatch(/Ажлын газраа/);
    expect(validateStep(1, { ...valid, emp: "pension", employer: "" }, [], {})).toBeNull();
  });

  it("заавал баримт дутуу бол нэрээр нь хэлнэ", () => {
    expect(validateStep(3, valid, ["id_front", "ndsh"], { id_front: "a.jpg" })).toMatch(/НДШ/);
    expect(validateStep(3, valid, ["id_front"], { id_front: "a.jpg" })).toBeNull();
  });

  it("мөнгөн дүнг тоо болгож илгээнэ, хамтран зээлдэгчгүй бол null", () => {
    const p = applicantPayload(valid);
    expect(p.monthly_income).toBe("2500000");
    expect(p.other_income).toBe("0");
    expect(p.cosigner).toBeNull();
  });

  it("өмнөх хүсэлтээр бөглөхдөө хугацаа хэтэрсэн зээлийг дахин асууна", () => {
    const f = fromApplicant(emptyForm(null), "Бат", "99", { monthly_income: 1500000, has_overdue: true });
    expect(f.income).toBe("1,500,000");
    expect(f.overdue).toBeNull();
  });

  it("хасагдсан хуудсуудын дугаарыг цоорхойгүй болгоно", () => {
    expect(packDocs({ bank_statement: null, bank_statement_2: "b.jpg", bank_statement_3: "c.jpg" })).toEqual({
      bank_statement: "b.jpg",
      bank_statement_2: "c.jpg",
    });
    expect(sortDocKeys(["bank_statement_2", "id_front", "bank_statement"])).toEqual([
      "id_front",
      "bank_statement",
      "bank_statement_2",
    ]);
  });
});
