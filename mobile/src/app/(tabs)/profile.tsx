import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { GuestGate } from "@/components/GuestGate";
import { C } from "@/lib/theme";
import { initial, roleLabel } from "@/lib/format";
import { Button, T, s } from "@/components/ui";
import { openWebPanel } from "@/lib/staff";


function ProfileTabInner() {
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
          {(staff || profile?.role === "dealer" || profile?.role === "leasing") && (
            <T w="semibold" style={{ fontSize: 12, color: C.pendingFg }}>{roleLabel(profile?.role)}{profile?.role === "dealer" && profile?.shop_name ? ` · ${profile.shop_name}` : ""}</T>
          )}
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
      <Button title="Миний лизингийн хүсэлтүүд" variant="ghost" icon="percent" onPress={() => router.push("/loans")} />
      {profile?.role === "leasing" && (
        <>
          <Button title="Лизингийн панел" icon="briefcase" onPress={() => router.push("/panel")} />
          <Button title="Вэб лизингийн панел" icon="external-link" variant="ghost" onPress={() => openWebPanel("/leasing")} />
        </>
      )}
      {staff && (
        <>
          <Button title="Удирдлага (апп дотор)" icon="shield" onPress={() => router.push("/panel")} />
          <Button
            title={profile?.role === "admin" ? "Вэб админ панел" : "Вэб менежерийн панел"}
            icon="external-link"
            variant="ghost"
            onPress={() => openWebPanel(profile?.role === "admin" ? "/admin" : "/manager")}
          />
        </>
      )}
      <Button title="Гарах" variant="danger" icon="log-out" onPress={signOut} />
    </ScrollView>
  );
}

export default function ProfileTab() {
  return (
    <GuestGate icon="user" title="Профайл" text="Нэвтэрч профайлаа үүсгээд зар тавьж, лизингийн хүсэлт илгээнэ." next="/profile">
      <ProfileTabInner />
    </GuestGate>
  );
}
