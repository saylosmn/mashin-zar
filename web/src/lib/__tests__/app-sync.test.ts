import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Апп (mobile/) дахь хуулбарууд вэбийнхтэй ижил дүрэмтэй эсэхийг шалгана — нэгийг нь өөрчилж нөгөөг мартахаас сэргийлнэ. */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const body = (s: string) => s.replace(/\/\*\*[\s\S]*?\*\/\s*/, "").trim(); // эхний тайлбарыг хасна

describe("вэб ↔ апп хуулбар", () => {
  it("commission.ts", () => {
    expect(body(read("../../../../mobile/src/lib/commission.ts"))).toBe(body(read("../commission.ts")));
  });
  it("compare.ts (цэвэр функцууд)", () => {
    const web = body(read("../compare.ts")).split("\n").filter((l) => !l.includes("compareHref")).join("\n");
    const app = read("../../../../mobile/src/lib/compare.ts");
    expect(app).toContain(web.slice(0, web.indexOf("/** Хүснэгтийн мөрөнд")).trim());
    expect(app).toContain("export function bestIndexes");
  });
  it("мэдэгдлийн төрлүүд апп-д бүгд бий", () => {
    const app = read("../../../../mobile/src/lib/notify-route.ts");
    for (const t of ["agent_commission", "ad_expiring", "ad_expired", "featured_on", "ad_flag", "featured_request", "sale_report", "loan_request", "loan_update"]) {
      expect(app).toContain(`"${t}"`);
    }
  });
});
