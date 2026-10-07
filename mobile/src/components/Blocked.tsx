import { View } from "react-native";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { Button, StateView, T } from "./ui";

export default function Blocked() {
  const { profile, signOut } = useAuth();
  return (
    <StateView
      icon="lock"
      iconBg={C.dangerBg}
      iconColor="#9B1C1C"
      title="Таны аккаунт түр хаагдсан байна"
      text="Админ таны аккаунтыг хаасан тул шинэ зар тавих, зараа удирдах боломжгүй. Дэлгэрэнгүйг манай багаас асууна уу."
    >
      <View style={{ alignItems: "center", paddingBottom: 6 }}>
        <T style={{ color: C.muted, fontSize: 13 }}>{profile?.email}</T>
      </View>
      <Button title="Өөр аккаунтаар нэвтрэх" variant="ghost" onPress={signOut} />
    </StateView>
  );
}
