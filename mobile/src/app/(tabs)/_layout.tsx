import { Pressable, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";
import { T } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isStaff } from "@/lib/staff";

const ITEMS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  index: { label: "Зарууд", icon: "home" },
  notifications: { label: "Мэдэгдэл", icon: "bell" },
  my: { label: "Миний зар", icon: "list" },
  panel: { label: "Панел", icon: "shield" },
  profile: { label: "Профайл", icon: "user" },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const staff = isStaff(profile);
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.paper } }}
      tabBar={({ state, navigation }) => {
        const routes = state.routes.filter((r) => ITEMS[r.name] && (r.name !== "panel" || staff));
        const cells = routes.map((r) => {
          const idx = state.routes.indexOf(r);
          const on = state.index === idx;
          const it = ITEMS[r.name];
          return (
            <Pressable
              key={r.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={it.label}
              onPress={() => navigation.navigate(r.name)}
              style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}
            >
              <Feather name={it.icon} size={22} color={on ? C.ink : C.muted} />
              <T w={on ? "semibold" : "body"} style={{ fontSize: 11, color: on ? C.ink : C.muted }}>{it.label}</T>
            </Pressable>
          );
        });
        return (
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderTopWidth: 1, borderColor: C.line, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 12 }}>
            {cells.slice(0, 2)}
            <View style={{ flex: 1, alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Зар нэмэх"
                onPress={() => router.push("/post")}
                style={{ width: 56, height: 56, marginTop: -28, borderRadius: 18, backgroundColor: C.yellow, borderWidth: 4, borderColor: C.paper, alignItems: "center", justifyContent: "center" }}
              >
                <Feather name="plus" size={26} color={C.ink} />
              </Pressable>
            </View>
            {cells.slice(2)}
          </View>
        );
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="my" />
      <Tabs.Screen name="panel" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
