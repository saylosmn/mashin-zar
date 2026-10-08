import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import * as Updates from "expo-updates";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import { T } from "./ui";

/** Шинэ хувилбар (EAS Update) татагдсан бол дээд хэсэгт "Шинэчлэх" мөр гаргана. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);

  const check = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) return;
      const f = await Updates.fetchUpdateAsync();
      if (f.isNew) setReady(true);
    } catch {
      // сүлжээгүй үед чимээгүй алгасна
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, [check]);

  if (!ready) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => Updates.reloadAsync().catch(() => {})}
      style={{ backgroundColor: C.yellow, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}
    >
      <Feather name="download" size={18} color={C.ink} />
      <T w="semibold" style={{ flex: 1, fontSize: 13 }}>Шинэ хувилбар бэлэн боллоо</T>
      <View style={{ backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
        <T w="bold" style={{ color: C.yellow, fontSize: 12 }}>Шинэчлэх</T>
      </View>
    </Pressable>
  );
}
