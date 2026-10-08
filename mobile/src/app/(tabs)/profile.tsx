import { Linking, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { initial } from "@/lib/format";
import { Button, T, s } from "@/components/ui";

const WEB = "https://web-mu-fawn-45.vercel.app";

export default function ProfileTab() {
  const { profile, signOut } = useAuth();
  const staff = profile?.role === "manager" || profile?.role === "admin";
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }}>
      <T w="display" style={{ fontSize: 22 }}>Профайл</T>
      <View style={[s.card, { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }]}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
          <T w="bold" style={{ color: C.yellow, fontSize: 22 }}>{initial(profile?.full_name ?? profile?.email)}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T w="semibold" style={{ fontSize: 17 }}>{profile?.full_name ?? "Нэр оруулаагүй"}</T>
          <T style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>{profile?.email}</T>
          {staff && <T w="semibold" style={{ fontSize: 12, color: C.pendingFg }}>{profile?.role === "admin" ? "Админ" : "Менежер"}</T>}
        </View>
      </View>
      <View style={[s.card]}>
        {[["Утас", profile?.phone ?? "—"], ["Хот", profile?.city ?? "—"]].map(([k, v], i) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", padding: 14, borderTopWidth: i ? 1 : 0, borderColor: "#ECEDE9" }}>
            <T style={{ color: C.muted, fontSize: 14 }}>{k}</T>
            <T w="semibold" style={{ fontSize: 14 }}>{v}</T>
          </View>
        ))}
      </View>
      <Button title={profile?.profile_completed ? "Профайл засах" : "Профайл үүсгэх"} variant="ghost" icon="edit-2" onPress={() => router.push("/complete-profile")} />
      {staff && (
        <Button
          title={profile?.role === "admin" ? "Админ панел нээх (вэб)" : "Менежерийн панел нээх (вэб)"}
          icon="external-link"
          onPress={() => Linking.openURL(`${WEB}/${profile?.role === "admin" ? "admin" : "manager"}`)}
        />
      )}
      <Button title="Гарах" variant="danger" icon="log-out" onPress={signOut} />
    </ScrollView>
  );
}
