import { Platform } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { AdBackend } from "@shared/ad-post";
import { supabase } from "@/lib/supabase";
import { WEB_URL } from "@/lib/staff";

async function compress(uri: string) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1600 });
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return fetch(out.uri).then((r) => r.arrayBuffer());
}

export async function uploadAdPhoto(uid: string, uri: string, index: number) {
  const body = await compress(uri);
  const path = `${uid}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("ad-photos").upload(path, body, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export function adBackend(uid: string, photoUris: string[]): AdBackend {
  return {
    uploadPhoto: (i) => uploadAdPhoto(uid, photoUris[i], i),
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
        p_ua: `Autoshop.mn апп (${Platform.OS})`,
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

/** Гарын үсэгтэй гэрээний PDF-ийг серверт урьдчилан бэлдүүлнэ (хариуг хүлээхгүй) */
export function prepareContractPdf(contractId: string, accessToken: string) {
  fetch(`${WEB_URL}/api/contracts/${contractId}/pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}
