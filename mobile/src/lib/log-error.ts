import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { supabase } from "./supabase";

const sent = new Set<string>();
let budget = 10; // нэг удаагийн ажиллагаанд хамгийн ихдээ

function version() {
  const v = Constants.expoConfig?.version ?? "?";
  const u = Updates.updateId ? `+${Updates.updateId.slice(0, 6)}` : "";
  return `${v}${u}`.slice(0, 40);
}

/** Апп-д гарсан алдааг админы «Алдааны бүртгэл» рүү илгээнэ (чимээгүй, давтагдахгүй). */
export function logAppError(err: unknown, where?: string) {
  try {
    if (budget <= 0) return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    const message = `${e.name && e.name !== "Error" ? `${e.name}: ` : ""}${e.message || "Тодорхойгүй алдаа"}`;
    if (/Network request failed|Failed to fetch|AbortError/i.test(message)) return;
    if (sent.has(message)) return;
    sent.add(message);
    budget--;
    supabase
      .rpc("log_client_error", {
        p_source: "app",
        p_message: message.slice(0, 500),
        p_stack: e.stack?.slice(0, 4000) ?? null,
        p_url: where?.slice(0, 300) ?? null,
        p_ua: `${Platform.OS} ${Platform.Version}`.slice(0, 200),
        p_version: version(),
      })
      .then(() => {}, () => {});
  } catch {
    // бүртгэл өөрөө алдаа үүсгэх ёсгүй
  }
}

let installed = false;
/** Барьж аваагүй JS алдааг бүртгэнэ (анхдагч зохицуулагчийг хэвээр дуудна). */
export function installErrorLogging() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    logAppError(e, fatal ? "fatal" : "global");
    prev(e, fatal);
  });
}
