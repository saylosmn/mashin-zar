import type { Settings } from "./types";

/**
 * APK нь GitHub Release-д "mashin-zar.apk" нэртэй хавсралт болж байрлана (GitHub Actions автоматаар хийнэ).
 * Repo private бол Vercel дээр GH_RELEASE_TOKEN (зөвхөн уншах эрхтэй токен) тохируулна.
 * Repo public бол токен хэрэггүй.
 */
const REPO = process.env.GH_RELEASE_REPO || "saylosmn/mashin-zar";
const ASSET = "mashin-zar.apk";

type GhAsset = { id: number; name: string; size: number; browser_download_url: string; updated_at: string };
type GhRelease = { tag_name: string; name: string | null; published_at: string; assets: GhAsset[] };

function ghHeaders(accept = "application/vnd.github+json"): HeadersInit {
  const h: Record<string, string> = { Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "mashin-zar-web" };
  const t = process.env.GH_RELEASE_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function latestAsset(): Promise<{ release: GhRelease; asset: GhAsset } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: ghHeaders(),
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const release = (await res.json()) as GhRelease;
    const asset = release.assets?.find((a) => a.name === ASSET);
    return asset ? { release, asset } : null;
  } catch {
    return null;
  }
}

export type ApkInfo = { version: string | null; sizeMb: number | null; date: string | null };

/** Апп татах хуудсанд харуулах мэдээлэл. null бол апп хараахан бэлэн биш. */
export async function apkInfo(s: Settings): Promise<ApkInfo | null> {
  const gh = await latestAsset();
  if (gh) {
    return {
      version: gh.release.name?.replace(/^.*v/i, "") || gh.release.tag_name,
      sizeMb: Math.round((gh.asset.size / 1024 / 1024) * 10) / 10,
      date: gh.release.published_at,
    };
  }
  if (s.apk_url) return { version: s.apk_version ?? null, sizeMb: null, date: s.apk_updated_at ?? null };
  return null;
}

/** Шууд татах URL. Private repo бол GitHub-ийн хэдэн минут хүчинтэй гарын үсэгтэй холбоосыг авна. */
export async function apkDownloadUrl(s: Settings): Promise<string | null> {
  const gh = await latestAsset();
  if (gh) {
    if (!process.env.GH_RELEASE_TOKEN) return gh.asset.browser_download_url;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${gh.asset.id}`, {
        headers: ghHeaders("application/octet-stream"),
        redirect: "manual",
        cache: "no-store",
      });
      const loc = res.headers.get("location");
      if (loc) return loc;
    } catch {}
  }
  return s.apk_url ?? null;
}
