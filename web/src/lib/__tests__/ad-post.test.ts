import { describe, expect, it, vi } from "vitest";
import { draftError, emptyAdFields, publishAd, toDraft, type AdBackend } from "@shared/ad-post";

const draft = toDraft({
  ...emptyAdFields("9911 2233"),
  brand: " Toyota ",
  model: "Prius",
  plate: "1234  уба",
  vin: "zvw55-1",
  yearMade: "2018",
  price: "35,000,000",
});

function fakeBackend(overrides: Partial<AdBackend> = {}) {
  const api = {
    uploadPhoto: vi.fn(async (i: number) => {
      await new Promise((r) => setTimeout(r, (3 - i) * 2)); // хожуу эхэлсэн нь түрүүлж дуусна
      return `p${i}.jpg`;
    }),
    removePhotos: vi.fn(async () => {}),
    signContract: vi.fn(async () => "contract-1"),
    insertAd: vi.fn(async () => "ad-1"),
    ...overrides,
  };
  return api;
}

const base = { userId: "u1", draft, photoCount: 4, agentId: null, signer: "Бат", contract: { current: null } };

describe("зар оруулах", () => {
  it("маягтын утгыг цэвэрлэнэ", () => {
    expect(draft).toMatchObject({
      brand: "Toyota",
      plate_number: "1234 УБА",
      vin: "ZVW55-1",
      phone: "99112233",
      price: 35000000,
    });
    expect(draftError(draft, 2, 3)).toMatch(/3 зураг/);
    expect(draftError(draft, 3, 3)).toBeNull();
  });

  it("зургийн дарааллыг хадгалж, гэрээтэй зар үүсгэнэ", async () => {
    const api = fakeBackend();
    const res = await publishAd(api, { ...base, plan: "commission", signature: "M1 1 L2 2" }, () => {});
    expect(res).toEqual({ id: "ad-1", cover: "p0.jpg", contractId: "contract-1" });
    expect(api.insertAd).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: ["p0.jpg", "p1.jpg", "p2.jpg", "p3.jpg"],
        contract_id: "contract-1",
        plan: "commission",
      }),
    );
  });

  it("авто худалдаа: гэрээгүй, plan талбаргүй", async () => {
    const api = fakeBackend();
    await publishAd(api, { ...base, plan: null, signature: null }, () => {});
    expect(api.signContract).not.toHaveBeenCalled();
    expect(vi.mocked(api.insertAd).mock.calls[0][0]).not.toHaveProperty("plan");
  });

  it("зар үүсгэж чадахгүй бол зургийг устгаж, дахин оролдоход гэрээг дахин ашиглана", async () => {
    const contract = { current: null as { key: string; id: string } | null };
    const failing = fakeBackend({ insertAd: vi.fn(async () => Promise.reject(new Error("db"))) });
    await expect(
      publishAd(failing, { ...base, contract, plan: "commission", signature: "M1 1" }, () => {}),
    ).rejects.toThrow("db");
    expect(failing.removePhotos).toHaveBeenCalledWith(expect.arrayContaining(["p0.jpg", "p3.jpg"]));
    expect(contract.current?.id).toBe("contract-1");

    const retry = fakeBackend();
    await publishAd(retry, { ...base, contract, plan: "commission", signature: "M1 1" }, () => {});
    expect(retry.signContract).not.toHaveBeenCalled();
    expect(contract.current).toBeNull();
  });

  it("зураг байршуулахад алдаа гарвал зогсоод амжилттайг нь устгана", async () => {
    const api = fakeBackend({
      uploadPhoto: vi.fn(async (i: number) => {
        if (i === 1) throw new Error("network");
        return `p${i}.jpg`;
      }),
    });
    await expect(publishAd(api, { ...base, plan: "paid", signature: null }, () => {})).rejects.toThrow("network");
    expect(api.insertAd).not.toHaveBeenCalled();
    expect(api.removePhotos).toHaveBeenCalled();
  });
});
