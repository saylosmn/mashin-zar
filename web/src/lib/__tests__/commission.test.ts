import { describe, expect, it } from "vitest";
import { agentAmount, commissionAmount, commissionFor, expiryInfo, hoursAgo, isFeatured, recentlyRequested } from "../commission";
import { DEFAULT_TERMS } from "../contract";

const pub = "2026-10-01T00:00:00Z";
const at = (h: number) => new Date(new Date(pub).getTime() + h * 36e5);

describe("commissionFor — гэрээний шат (2 хоног 3%, 7 хоног 2%, 10 хоног 1.5%, дараа нь 1.5%)", () => {
  it("эхний 48 цагт 3%", () => {
    expect(commissionFor(DEFAULT_TERMS, pub, at(1))).toEqual({ days: 1, percent: 3 });
    expect(commissionFor(DEFAULT_TERMS, pub, at(48))).toEqual({ days: 2, percent: 3 });
  });
  it("48 цагаас хэтэрмэгц 2%", () => {
    expect(commissionFor(DEFAULT_TERMS, pub, at(48.01))).toEqual({ days: 3, percent: 2 });
    expect(commissionFor(DEFAULT_TERMS, pub, at(7 * 24))).toEqual({ days: 7, percent: 2 });
  });
  it("7–10 хоногт 1.5%, түүнээс хойш after", () => {
    expect(commissionFor(DEFAULT_TERMS, pub, at(8 * 24)).percent).toBe(1.5);
    expect(commissionFor({ ...DEFAULT_TERMS, after: 1 }, pub, at(30 * 24)).percent).toBe(1);
  });
  it("шат эрэмбэгүй ирсэн ч зөв, хамгийн бага нь 1 хоног", () => {
    const t = { tiers: [{ days: 7, percent: 2 }, { days: 2, percent: 3 }], after: 1 };
    expect(commissionFor(t, pub, at(10))).toEqual({ days: 1, percent: 3 });
    expect(commissionFor(t, pub, pub).days).toBe(1);
  });
  it("зарагдсан өдөр нийтлэгдэхээс өмнө байвал 0 цаг гэж үзнэ", () => {
    expect(commissionFor(DEFAULT_TERMS, pub, at(-5))).toEqual({ days: 1, percent: 3 });
  });
});

describe("дүн", () => {
  it("шимтгэл бүхэл төгрөгөөр", () => {
    expect(commissionAmount(35_000_000, 2)).toBe(700_000);
    expect(commissionAmount(12_345_678, 1.5)).toBe(185_185);
  });
  it("агентын хувь 0–100-д хязгаарлагдана", () => {
    expect(agentAmount(700_000, 50)).toBe(350_000);
    expect(agentAmount(700_000, 150)).toBe(700_000);
    expect(agentAmount(700_000, -5)).toBe(0);
  });
});

describe("expiryInfo", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("хугацаагүй", () => expect(expiryInfo(null, now)).toEqual({ none: true, expired: false, daysLeft: 0, renewable: false }));
  it("30 хоног үлдсэн — сунгах боломжгүй", () => {
    const e = expiryInfo("2026-11-09T12:00:00Z", now);
    expect(e).toMatchObject({ expired: false, daysLeft: 30, renewable: false });
  });
  it("7 хоног үлдсэн үеэс сунгана", () => {
    expect(expiryInfo("2026-10-17T12:00:00Z", now).renewable).toBe(true);
    expect(expiryInfo("2026-10-17T12:00:01Z", now).renewable).toBe(false);
  });
  it("хагас хоног үлдсэн бол 1 хоног гэж харуулна", () => expect(expiryInfo("2026-10-11T00:00:00Z", now).daysLeft).toBe(1));
  it("дууссан", () => expect(expiryInfo("2026-10-10T11:59:59Z", now)).toMatchObject({ expired: true, daysLeft: 0, renewable: true }));
});

describe("онцлох", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("isFeatured", () => {
    expect(isFeatured("2026-10-11T00:00:00Z", now)).toBe(true);
    expect(isFeatured("2026-10-10T11:00:00Z", now)).toBe(false);
    expect(isFeatured(null, now)).toBe(false);
  });
  it("recentlyRequested — 24 цаг", () => {
    expect(recentlyRequested("2026-10-09T13:00:00Z", now)).toBe(true);
    expect(recentlyRequested("2026-10-09T11:00:00Z", now)).toBe(false);
    expect(recentlyRequested(undefined, now)).toBe(false);
  });
  it("hoursAgo", () => expect(hoursAgo(24, now)).toBe("2026-10-09T12:00:00.000Z"));
});
