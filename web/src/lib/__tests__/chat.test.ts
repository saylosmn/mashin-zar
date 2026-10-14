import { describe, expect, it } from "vitest";
import { cleanMessage, dayLabel, timeHM } from "@shared/chat";

describe("чат", () => {
  const now = new Date("2026-10-11T15:00:00Z"); // УБ 23:00
  it("цаг Улаанбаатараар", () => expect(timeHM("2026-10-11T01:05:00Z")).toBe("09:05"));
  it("өнөөдөр / өчигдөр / огноо", () => {
    expect(dayLabel("2026-10-11T00:30:00Z", now)).toBe("Өнөөдөр");
    expect(dayLabel("2026-10-10T03:00:00Z", now)).toBe("Өчигдөр");
    expect(dayLabel("2026-10-01T03:00:00Z", now)).toBe("2026.10.01");
  });
  it("УТС-аар өдөр солигдох зааг (УБ 00:30 = UTC өмнөх өдөр 16:30)", () => {
    expect(dayLabel("2026-10-10T16:30:00Z", now)).toBe("Өнөөдөр");
  });
  it("cleanMessage", () => {
    expect(cleanMessage("  сайн уу ")).toBe("сайн уу");
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage("a".repeat(1001))).toBeNull();
  });
});
