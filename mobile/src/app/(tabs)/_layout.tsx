import { Pressable, View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";
import { T } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isStaff } from "@/lib/staff";
import { requireLogin } from "@/lib/guest";
import { useChatUnread } from "@/lib/chat-unread";

const ITEMS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  index: { label: "Зарууд", icon: "home" },
  messages: { label: "Чат", icon: "message-circle" },
  my: { label: "Миний зар", icon: "list" },
  panel: { label: "Панел", icon: "shield" },
  profile: { label: "Профайл", icon: "user" },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const staff = isStaff(profile) || profile?.role === "leasing";
  const chats = useChatUnread(!!session);
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
              <View>
                <Feather name={it.icon} size={22} color={on ? C.ink : C.muted} />
                {r.name === "messages" && chats > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -10,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 4,
                      borderRadius: 9,
                      backgroundColor: "#FF7A1A",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <T w="bold" style={{ fontSize: 10, color: C.ink }}>
                      {chats > 99 ? "99+" : chats}
                    </T>
                  </View>
                ) : null}
              </View>
              <T w={on ? "semibold" : "body"} style={{ fontSize: 11, color: on ? C.ink : C.muted }}>
                {it.label}
              </T>
            </Pressable>
          );
        });
        return (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: C.card,
              borderTopWidth: 1,
              borderColor: C.line,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 12),
              paddingHorizontal: 12,
            }}
          >
            {cells.slice(0, 2)}
            <View style={{ flex: 1, alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Зар нэмэх"
                onPress={() => (session ? router.push("/post") : requireLogin("/post"))}
                style={{
                  width: 56,
                  height: 56,
                  marginTop: -28,
                  borderRadius: 18,
                  backgroundColor: C.yellow,
                  borderWidth: 4,
                  borderColor: C.paper,
                  alignItems: "center",
                  justifyContent: "center",
                }}
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
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="my" />
      <Tabs.Screen name="panel" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
