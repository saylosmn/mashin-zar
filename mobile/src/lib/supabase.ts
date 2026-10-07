import "expo-sqlite/localStorage/install";
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Нээлттэй (publishable) түлхүүр — апп-д оруулахад аюулгүй, хамгаалалт нь RLS дээр.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://nthyjkkdkxyilwuamnqd.supabase.co";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_FbZFXiBuJYyO7TjhDECimQ_IqD2y_Jt";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const photoUrl = (path?: string | null) =>
  path ? (path.startsWith("http") ? path : `${SUPABASE_URL}/storage/v1/object/public/ad-photos/${path}`) : null;
