import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Вэб болон апп мэдэгдлийн төрөл бүрийг өөр өөрийн хуудас руу чиглүүлдэг.
// Шинэ төрөл нэмэхэд аль нэгийг нь мартвал энэ тест унана.
const TYPES = [
  "message",
  "agent_commission",
  "ad_expiring",
  "ad_expired",
  "featured_on",
  "ad_flag",
  "featured_request",
  "sale_report",
  "loan_request",
  "loan_update",
  "payment_submitted",
  "payment_ok",
  "payment_rejected",
];

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

describe("мэдэгдлийн чиглүүлэлт", () => {
  it.each([
    ["вэб", "../notify-href.ts"],
    ["апп", "../../../../mobile/src/lib/notify-route.ts"],
  ])("%s бүх төрлийг мэднэ", (_, file) => {
    const src = read(file);
    for (const t of TYPES) expect(src).toContain(`"${t}"`);
  });
});
