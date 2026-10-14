import type { AdBackend } from "@shared/ad-post";
import { createClient } from "@/lib/supabase/client";

/** Том зургийг 1600px хүртэл багасгаж JPEG болгоно */
async function compress(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
}

export function adBackend(userId: string, files: File[]): AdBackend {
  const supabase = createClient();
  return {
    async uploadPhoto(i) {
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("ad-photos")
        .upload(path, await compress(files[i]), { contentType: "image/jpeg" });
      if (error) throw error;
      return path;
    },
    async removePhotos(paths) {
      await supabase.storage.from("ad-photos").remove(paths);
    },
    async signContract(d, signer, signature) {
      const { data, error } = await supabase.rpc("sign_contract", {
        p_full_name: signer,
        p_phone: d.phone,
        p_brand: d.brand,
        p_model: d.model,
        p_year: d.year_made,
        p_plate: d.plate_number,
        p_vin: d.vin,
        p_price: d.price,
        p_signature: signature,
        p_ua: navigator.userAgent,
      });
      if (error) throw error;
      return data as string;
    },
    async insertAd(row) {
      const { data, error } = await supabase.from("ads").insert(row).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
  };
}
