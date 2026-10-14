/**
 * Халдлагаас сэргийлэх хамгаалалт (proxy.ts-ээс хүсэлт бүрт дуудна):
 * - сканнер / эксплойт хайгч хаягууд (/.env, /wp-admin, *.php …) -> шууд 404
 * - халдлагын хэрэгслийн User-Agent (sqlmap, nikto, nuclei …) -> 403
 * - IP тутмын хурдны хязгаар (brute force, спам, scraping) -> 429
 * - хэт том хүсэлтийн бие -> 413
 * Vercel Firewall-ийн дүрмүүдтэй хамт ажиллана (тэнд edge дээр, энд сервер дээр давхар хаалт).
 */

const SCANNER_PATH =
  /(^|\/)(\.env|\.git|\.svn|\.hg|\.ds_store|\.aws|\.ssh|\.htaccess|\.htpasswd|\.vscode|\.idea|wp-admin|wp-login|wp-content|wp-includes|xmlrpc|phpmyadmin|pma|adminer|cgi-bin|vendor\/phpunit|actuator|server-status|config\.(json|yml|yaml|php)|web\.config|id_rsa|backup\.(zip|sql|tar|gz)|dump\.sql|database\.sql|boaform|hnap1|owa|autodiscover|telescope|_profiler|solr|druid|jmx-console|console\/login|manager\/html)(\/|$|\.|\?)|\.(php\d?|asp|aspx|jsp|cgi|pl|env|ini|sql|bak|old|swp|log)$/i;

const BAD_AGENT =
  /(sqlmap|nikto|nmap|masscan|zgrab|zmeu|acunetix|netsparker|nessus|openvas|nuclei|wpscan|dirbuster|gobuster|feroxbuster|ffuf|wfuzz|hydra|medusa|jaeles|whatweb|httpx-toolkit|commix|xsstrike|arachni|skipfish|w3af|appscan|burpcollaborator|interactsh)/i;

/** Сканнерын түгээмэл хаяг уу (манай сайтад хэзээ ч байхгүй) */
export function isScannerPath(path: string): boolean {
  return SCANNER_PATH.test(path);
}

/** Халдлагын хэрэгслийн User-Agent уу */
export function isBadAgent(ua: string | null | undefined): boolean {
  return !!ua && BAD_AGENT.test(ua);
}

export type Rule = { bucket: string; limit: number; windowMs: number };

const MIN = 60_000;

/** Хүсэлтэд тохирох хурдны хязгаар (IP тутам, нэг минутад). null = хязгааргүй. */
export function rateRule(method: string, path: string, isServerAction: boolean): Rule | null {
  const m = method.toUpperCase();
  // Өгөгдлийн сан (pg_net) нэг IP-гаас олон push илгээдэг; нууц түлхүүрээр хамгаалагдсан
  if (path.startsWith("/api/push/")) return null;
  if (path === "/api/sms") return { bucket: "sms", limit: 40, windowMs: MIN };
  if (path.startsWith("/api/contracts")) return { bucket: "contracts", limit: 20, windowMs: MIN };
  if (path.startsWith("/api/loan-docs")) return { bucket: "loan-docs", limit: 60, windowMs: MIN };
  if (path === "/login" || path.startsWith("/auth/")) return { bucket: "auth", limit: 30, windowMs: MIN };
  if (isServerAction) return { bucket: "action", limit: 45, windowMs: MIN };
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") return { bucket: "write", limit: 60, windowMs: MIN };
  return { bucket: "read", limit: 600, windowMs: MIN };
}

/** Хэт том биетэй хүсэлт уу (server action 2MB, API 1MB хүртэл) */
export function tooLarge(method: string, path: string, contentLength: string | null): boolean {
  if (!contentLength) return false;
  const n = Number(contentLength);
  if (!Number.isFinite(n)) return false;
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") return n > 0;
  return n > (path.startsWith("/api/") ? 1_000_000 : 2_500_000);
}

/** Хүсэлт илгээгчийн IP (Vercel-ийн толгойнуудаас) */
export function clientIp(h: Headers): string {
  const v = h.get("x-real-ip") || h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || "";
  return v.split(",")[0].trim() || "unknown";
}

/**
 * Энгийн гулсах цонхтой хурдны хязгаарлагч (санах ойд, нэг серверийн инстанс дотор).
 * Олон инстанс дээр бүрэн биш тул Vercel Firewall-ийн rate limit-тэй хамт ашиглана.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private maxKeys = 20_000) {}

  /** true = зөвшөөрнө, number = хэдэн секундын дараа дахин оролдох */
  check(key: string, rule: Rule, now = Date.now()): true | number {
    const k = `${rule.bucket}:${key}`;
    const since = now - rule.windowMs;
    const arr = (this.hits.get(k) ?? []).filter((t) => t > since);
    if (arr.length >= rule.limit) {
      this.hits.set(k, arr);
      return Math.max(1, Math.ceil((arr[0] + rule.windowMs - now) / 1000));
    }
    arr.push(now);
    this.hits.delete(k); // Map-ийн дараалал = сүүлд ашигласан (LRU)
    this.hits.set(k, arr);
    if (this.hits.size > this.maxKeys) {
      const drop = this.hits.size - this.maxKeys;
      let i = 0;
      for (const key of this.hits.keys()) {
        if (i++ >= drop) break;
        this.hits.delete(key);
      }
    }
    return true;
  }
}
