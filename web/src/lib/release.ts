import release from "@/app-release.json";
import type { Settings } from "./types";

/** Татах APK: GitHub Actions-ийн build-ээр сайт дээр байрлуулсан файл, эс бөгөөс админы оруулсан холбоос. */
export function apkInfo(s: Settings) {
  if (release.available) {
    return {
      url: "/mashin-zar.apk",
      version: release.version as string | null,
      sizeMb: release.size ? Math.round((release.size / 1024 / 1024) * 10) / 10 : null,
      date: release.builtAt as string | null,
    };
  }
  if (s.apk_url) return { url: s.apk_url, version: s.apk_version ?? null, sizeMb: null, date: s.apk_updated_at ?? null };
  return null;
}
