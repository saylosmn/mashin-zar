import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { GuestGate } from "@/components/GuestGate";
import { C } from "@/lib/theme";
import { initial, roleLabel } from "@/lib/format";
import { Button, T, s } from "@/components/ui";
import { openWebPanel } from "@/lib/staff";
import { useState } from "react";
import { Alert } from "react-native";
import { PUSH_REASON, registerPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { errMsg } from "@/lib/format";


function ProfileTabInner() {
  const { profile, signOut, session } = useAuth();
  const [testing, setTesting] = useState(false);

  async function testPush() {
    if (!session) return;
    setTesting(true);
    const st = await registerPush(session.user.id);
    if (!st.ok) {
      setTesting(false);
      return Alert.alert("Мэдэгдэл ажиллахгүй байна", `${PUSH_REASON[st.reason]}${st.detail ? `\n\n(${st.detail})` : ""}`);
    }
    const { error } = await supabase.rpc("test_push");
    setTesting(false);
    if (error) return Alert.alert("Илгээж чадсангүй", errMsg(error));
    Alert.alert("Илгээгдлээ", "5–30 секундэд «Туршилтын мэдэгдэл» ирэх ёстой. Апп-аа хаагаад (эсвэл гадагш гараад) хүлээгээрэй. Ирэхгүй бол админд хэлнэ үү.");
  }
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
          {(staff || profile?.role === "dealer" || profile?.role === "leasing" || profile?.role === "agent") && (
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
      <Button title="Машин харьцуулах" variant="ghost" icon="shuffle" onPress={() => router.push("/compare")} />
      <Button title="Мэдэгдэл шалгах (туршилт)" variant="ghost" icon="bell" loading={testing} onPress={testPush} />
      {profile?.role === "agent" && (
        <Button title="Агентын самбар" icon="award" onPress={() => router.push("/agent")} />
      )}
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
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, paddingVertical: 4 }}>
        <T style={{ fontSize: 13, color: C.muted, textDecorationLine: "underline" }} onPress={() => openWebPanel("/terms")}>Үйлчилгээний нөхцөл</T>
        <T style={{ fontSize: 13, color: C.muted, textDecorationLine: "underline" }} onPress={() => openWebPanel("/privacy")}>Нууцлалын бодлого</T>
      </View>
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
