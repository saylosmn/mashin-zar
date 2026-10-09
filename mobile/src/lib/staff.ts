import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
import { errMsg } from "./format";
import type { Ad, Profile } from "./types";

export const WEB_URL = "https://web-mu-fawn-45.vercel.app";

export type Owner = { full_name: string | null; email: string | null; phone: string | null; city: string | null };
export type StaffAd = Ad & { owner: Owner | null };

/** Зар + зар тавьсан хүний мэдээлэл (зөвхөн менежер/админд RLS зөвшөөрнө) */
export const STAFF_AD_SELECT = "*, owner:profiles!ads_user_id_fkey(full_name,email,phone,city)";

export const isStaff = (p?: Profile | null) => p?.role === "manager" || p?.role === "admin";
export const isAdmin = (p?: Profile | null) => p?.role === "admin";

/** Менежер/админы RPC дуудаад алдаа гарвал ойлгомжтой цонх харуулна. */
export async function staffRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; data: T | null }> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    Alert.alert("Амжилтгүй", errMsg(error));
    return { ok: false, data: null };
  }
  return { ok: true, data: data as T };
}

export function confirm(title: string, message: string, okText: string, destructive = false): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Болих", style: "cancel", onPress: () => resolve(false) },
      { text: okText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

/** Вэб панелийг апп доторх хөтчөөр нээнэ (Chrome-ийн нэвтрэлт хадгалагдана). */
export async function openWebPanel(path: string) {
  try {
    await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, {
      toolbarColor: "#111317",
      controlsColor: "#F5B800",
      showTitle: true,
    });
  } catch (e) {
    Alert.alert("Нээж чадсангүй", errMsg(e));
  }
}

export const digits = (s: string) => s.replace(/\D/g, "");

/** Гарын үсэгтэй гэрээний PDF-ийг нээнэ (эзэмшигч, менежер, админ). */
export async function openContract(contractId: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Дахин нэвтэрнэ үү");
    const r = await fetch(`${WEB_URL}/api/contracts/${contractId}/pdf`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!r.ok || !j.url) throw new Error(j.error ?? "Гэрээ нээж чадсангүй");
    await WebBrowser.openBrowserAsync(j.url, { toolbarColor: "#111317", controlsColor: "#F5B800" });
  } catch (e) {
    Alert.alert("Гэрээ нээж чадсангүй", errMsg(e));
  }
}
