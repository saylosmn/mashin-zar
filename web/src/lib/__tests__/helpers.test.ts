import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyHref } from "../notify-href";
import { safeNext } from "../safe-next";
import { normAgentCode, siteUrl } from "../site";
import { DEFAULT_TERMS, termsFrom, tierLines } from "../contract";
import { minDown, monthlyPayment, rdBirthDate, termOptions } from "../loan";

describe("notifyHref", () => {
  const ad = "11111111-1111-4111-8111-111111111111";
  it("агент, хугацаа, онцлох", () => {
    expect(notifyHref({ type: "agent_commission", ad_id: ad }, "agent")).toBe("/agent");
    expect(notifyHref({ type: "ad_expiring", ad_id: ad }, "user")).toBe("/my");
    expect(notifyHref({ type: "ad_expired", ad_id: ad }, "user")).toBe("/my");
    expect(notifyHref({ type: "featured_on", ad_id: ad }, "user")).toBe("/my");
  });
  it("гомдол, онцлох хүсэлт зөвхөн эрхтэй хүнд панел руу", () => {
    expect(notifyHref({ type: "ad_flag", ad_id: ad }, "manager")).toBe("/manager/flags");
    expect(notifyHref({ type: "ad_flag", ad_id: ad }, "user")).toBe("/notifications");
    expect(notifyHref({ type: "featured_request", ad_id: ad }, "admin")).toBe("/admin/ads?featured=1");
  });
  it("хуучин төрлүүд хэвээр", () => {
    expect(notifyHref({ type: "staff_new_ad", ad_id: ad }, "manager")).toBe(`/manager/ads?id=${ad}`);
    expect(notifyHref({ type: "staff_new_ad", ad_id: ad }, "user")).toBe(`/ads/${ad}`);
    expect(notifyHref({ type: "new_ad", ad_id: ad }, null)).toBe(`/ads/${ad}`);
    expect(notifyHref({ type: "sale_report", ad_id: null }, "admin")).toBe("/admin/reports");
    expect(notifyHref({ type: "broadcast", ad_id: null }, "user")).toBe("/notifications");
  });
});

describe("safeNext (open redirect хамгаалалт)", () => {
  it.each([["//evil.com"], ["/\\evil.com"], ["https://evil.com"], [""], [null], [42]])("%s → /", (v) => expect(safeNext(v)).toBe("/"));
  it("өөрийн зам", () => expect(safeNext("/ads/1?x=2")).toBe("/ads/1?x=2"));
});

describe("агентын код", () => {
  it("normAgentCode", () => {
    expect(normAgentCode(" k7m2qx ")).toBe("K7M2QX");
    expect(normAgentCode("AB")).toBeNull();
    expect(normAgentCode("ABC-123")).toBeNull();
    expect(normAgentCode(undefined)).toBeNull();
  });
});

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("NEXT_PUBLIC_SITE_URL-ийн сүүлийн / -ийг хасна", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mashinzar.mn/");
    expect(siteUrl()).toBe("https://mashinzar.mn");
  });
  it("тохиргоогүй бол Vercel-ийн хаяг", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("https://web-mu-fawn-45.vercel.app");
  });
});

describe("гэрээ", () => {
  it("termsFrom — SQL ажиллаагүй үед анхны нөхцөл", () => {
    expect(termsFrom({})).toEqual({ company: "Autoshop ХХК", terms: DEFAULT_TERMS });
    expect(termsFrom({ commission_after: "2.5", commission_tiers: [{ days: 3, percent: 4 }] }).terms).toEqual({ tiers: [{ days: 3, percent: 4 }], after: 2.5 });
  });
  it("tierLines", () => {
    const l = tierLines(DEFAULT_TERMS);
    expect(l).toHaveLength(4);
    expect(l[0]).toContain("2 хоногийн дотор");
    expect(l[3]).toContain("10 хоногоос хойш");
  });
});

describe("лизинг", () => {
  it("сарын төлбөр (аннуитет) — SQL-ийн loan_monthly-тай ижил", () => {
    expect(monthlyPayment(30_000_000, 24, 36)).toBe(1_176_986);
    expect(monthlyPayment(12_000_000, 0, 12)).toBe(1_000_000);
    expect(monthlyPayment(0, 24, 12)).toBe(0);
  });
  it("хугацааны сонголт, урьдчилгаа", () => {
    expect(termOptions(40)).toEqual([6, 12, 18, 24, 30, 36, 40]);
    expect(minDown(35_000_001, 30)).toBe(10_500_001);
  });
  it("регистрээс төрсөн огноо", () => {
    expect(rdBirthDate("УБ99112233")?.toISOString().slice(0, 10)).toBe("1999-11-22");
    expect(rdBirthDate("уб 03 21 05 11")?.toISOString().slice(0, 10)).toBe("2003-01-05");
    expect(rdBirthDate("УБ99132233")).toBeNull();
    expect(rdBirthDate("AB99112233")).toBeNull();
  });
});
