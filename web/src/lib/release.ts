import "server-only";
/**
 * APK нь GitHub Release-д "mashin-zar.apk" нэртэй хавсралт болж байрлана (GitHub Actions автоматаар хийнэ).
 * Repo public бол токен хэрэггүй. Private бол Vercel дээр GH_RELEASE_TOKEN (Contents: Read-only) тохируулна.
 */
const REPO = process.env.GH_RELEASE_REPO || "saylosmn/mashin-zar";
const ASSET = "mashin-zar.apk";
/** Public repo-д API дуудалгүйгээр хамгийн сүүлийн Release-ийн файл руу шууд очих холбоос */
const LATEST_URL = `https://github.com/${REPO}/releases/latest/download/${ASSET}`;

type GhAsset = { id: number; name: string; size: number; browser_download_url: string };
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
export async function apkInfo(): Promise<ApkInfo | null> {
  const gh = await latestAsset();
  if (!gh) return null;
  return {
    version: gh.release.name?.match(/v([\d.]+)/i)?.[1] ?? null,
    sizeMb: Math.round((gh.asset.size / 1024 / 1024) * 10) / 10,
    date: gh.release.published_at,
  };
}

/** Шууд татах URL. Private repo бол GitHub-ийн хэдэн минут хүчинтэй гарын үсэгтэй холбоосыг авна. */
export async function apkDownloadUrl(): Promise<string> {
  if (!process.env.GH_RELEASE_TOKEN) return LATEST_URL;
  const gh = await latestAsset();
  if (!gh) return LATEST_URL;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${gh.asset.id}`, {
      headers: ghHeaders("application/octet-stream"),
      redirect: "manual",
      cache: "no-store",
    });
    return res.headers.get("location") ?? LATEST_URL;
  } catch {
    return LATEST_URL;
  }
}
