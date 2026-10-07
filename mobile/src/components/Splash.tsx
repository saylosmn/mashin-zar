import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import Constants from "expo-constants";
import { C } from "@/lib/theme";
import { T } from "./ui";

export default function Splash() {
  const x = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 180, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View style={{ flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", gap: 40, padding: 32 }}>
      <View style={{ alignItems: "center", gap: 18 }}>
        <View style={{ width: 112, height: 76, borderWidth: 4, borderColor: C.paper, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
          <T w="monoBold" style={{ color: C.paper, fontSize: 32, letterSpacing: 2 }}>МЗ</T>
        </View>
        <T w="display" style={{ color: C.paper, fontSize: 24 }}>Машин зар</T>
      </View>
      <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 16 }}>
        <View style={{ width: 180, height: 6, borderRadius: 3, backgroundColor: "#2A2E35", overflow: "hidden" }}>
          <Animated.View style={{ width: 72, height: 6, borderRadius: 3, backgroundColor: C.yellow, transform: [{ translateX: x }] }} />
        </View>
        <T style={{ color: "#C9CDD3" }}>Уншиж байна, түр хүлээнэ үү…</T>
      </View>
      <T w="mono" style={{ position: "absolute", bottom: 40, color: "#8A9099", fontSize: 12 }}>v{Constants.expoConfig?.version ?? "1.0.0"}</T>
    </View>
  );
}
