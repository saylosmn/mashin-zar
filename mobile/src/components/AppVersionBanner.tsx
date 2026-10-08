import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, View } from "react-native";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import { WEB_URL } from "@/lib/staff";
import { T } from "./ui";

const num = (v?: string | null) => String(v ?? "0").split(".").map((x) => Number(x) || 0).concat([0, 0, 0]).slice(0, 3);
const newer = (a?: string | null, b?: string | null) => {
  const x = num(a), y = num(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

/** Шинэ APK (шинэ суулгац шаардсан хувилбар) гарсан бол "Татах" мөр гаргана. */
export function AppVersionBanner() {
  const [info, setInfo] = useState<{ version: string; url: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || Platform.OS !== "android") return;
    if (Date.now() - last.current < 30 * 60 * 1000) return;
    last.current = Date.now();
    try {
      const r = await fetch(`${WEB_URL}/api/app-version`);
      const j = (await r.json()) as { version: string | null; url: string };
      const mine = Updates.runtimeVersion ?? Constants.expoConfig?.version ?? "0";
      if (j.version && newer(j.version, mine) > 0) setInfo({ version: j.version, url: j.url });
    } catch {
      // сүлжээгүй үед алгасна
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, [check]);

  if (!info || hidden) return null;
  return (
    <View style={{ backgroundColor: C.ink, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16, paddingRight: 6, paddingVertical: 8 }}>
      <Feather name="smartphone" size={18} color={C.yellow} />
      <T w="semibold" style={{ flex: 1, fontSize: 13, color: C.paper }}>Апп-ын шинэ хувилбар (v{info.version}) гарлаа</T>
      <Pressable accessibilityRole="button" onPress={() => Linking.openURL(info.url).catch(() => {})} style={{ backgroundColor: C.yellow, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
        <T w="bold" style={{ fontSize: 12 }}>Татах</T>
      </Pressable>
      <Pressable accessibilityLabel="Хаах" hitSlop={8} onPress={() => setHidden(true)} style={{ padding: 6 }}>
        <Feather name="x" size={16} color={C.pale} />
      </Pressable>
    </View>
  );
}
