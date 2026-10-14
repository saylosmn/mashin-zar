import { describe, expect, it } from "vitest";
import { RateLimiter, clientIp, isBadAgent, isScannerPath, rateRule, tooLarge } from "../shield";

describe("халдлагаас хамгаалах (shield)", () => {
  it("сканнерын хаягийг танина", () => {
    for (const p of [
      "/.env",
      "/.git/config",
      "/wp-admin/setup.php",
      "/wp-login.php",
      "/index.php",
      "/phpmyadmin/",
      "/vendor/phpunit/x",
      "/cgi-bin/luci",
      "/xmlrpc.php",
      "/backup.sql",
      "/actuator/health",
      "/manager/html",
    ]) {
      expect(isScannerPath(p), p).toBe(true);
    }
  });
  it("жинхэнэ хуудсыг хаахгүй", () => {
    for (const p of [
      "/",
      "/ads/123e4567-e89b-12d3-a456-426614174000",
      "/admin",
      "/admin/review",
      "/manager",
      "/manager/ads",
      "/post",
      "/my",
      "/api/sms",
      "/api/contracts/1/pdf",
      "/app/download",
      "/environment-cars",
      "/compare",
      "/leasing",
      "/login",
      "/auth/callback",
    ]) {
      expect(isScannerPath(p), p).toBe(false);
    }
  });
  it("халдлагын хэрэгслийн User-Agent", () => {
    expect(isBadAgent("sqlmap/1.7.2#stable (https://sqlmap.org)")).toBe(true);
    expect(isBadAgent("Mozilla/5.00 (Nikto/2.1.6)")).toBe(true);
    expect(isBadAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(false);
    expect(isBadAgent("okhttp/4.12.0")).toBe(false);
    expect(isBadAgent(null)).toBe(false);
  });
  it("хурдны дүрэм", () => {
    expect(rateRule("POST", "/api/sms", false)?.bucket).toBe("sms");
    expect(rateRule("POST", "/api/push/web", false)).toBeNull();
    expect(rateRule("POST", "/admin/review", true)?.bucket).toBe("action");
    expect(rateRule("GET", "/auth/callback", false)?.bucket).toBe("auth");
    expect(rateRule("GET", "/", false)?.limit).toBe(600);
  });
  it("хэт том хүсэлт", () => {
    expect(tooLarge("POST", "/api/sms", "2000000")).toBe(true);
    expect(tooLarge("POST", "/api/sms", "500")).toBe(false);
    expect(tooLarge("POST", "/post", "2000000")).toBe(false);
    expect(tooLarge("GET", "/", "10")).toBe(true);
    expect(tooLarge("GET", "/", "0")).toBe(false);
    expect(tooLarge("GET", "/", null)).toBe(false);
  });
  it("IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("хурдны хязгаарлагч: хязгаар хүрмэгц 429, цонх өнгөрөхөд дахин зөвшөөрнө", () => {
    const rl = new RateLimiter();
    const rule = { bucket: "t", limit: 3, windowMs: 60_000 };
    const t0 = 1_000_000;
    expect(rl.check("ip", rule, t0)).toBe(true);
    expect(rl.check("ip", rule, t0 + 1)).toBe(true);
    expect(rl.check("ip", rule, t0 + 2)).toBe(true);
    expect(rl.check("ip", rule, t0 + 3)).toBe(60);
    expect(rl.check("other-ip", rule, t0 + 3)).toBe(true);
    expect(rl.check("ip", rule, t0 + 60_001)).toBe(true);
  });
  it("санах ой хязгаартай", () => {
    const rl = new RateLimiter(100);
    const rule = { bucket: "t", limit: 1, windowMs: 60_000 };
    for (let i = 0; i < 1000; i++) rl.check(`ip${i}`, rule, 1);
    expect(rl.check("ip999", rule, 2)).toBe(60); // хамгийн сүүлийнх нь санагдсан
    expect(rl.check("ip0", rule, 2)).toBe(true); // хуучин нь шахагдаж гарсан
  });
});
