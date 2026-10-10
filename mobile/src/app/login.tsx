import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { errMsg } from "@/lib/format";
import { Button, T } from "@/components/ui";

export default function Login() {
  const { signInWithGoogle, session } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const done = useRef(false);

  // Нэвтэрмэгц хүссэн дэлгэц рүү (эсвэл буцаж) шилжинэ
  useEffect(() => {
    if (!session || done.current) return;
    done.current = true;
    const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
    if (target) router.replace(target as Href);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [session, next]);

  const skip = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={{ flex: 1, backgroundColor: C.ink, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Нэвтрэлгүйгээр үзэх" onPress={skip} hitSlop={12} style={{ position: "absolute", right: 0, paddingVertical: 6 }}>
          <T style={{ color: C.pale, fontSize: 14 }}>Алгасах ✕</T>
        </Pressable>
        <View style={{ width: 44, height: 30, borderWidth: 2, borderColor: C.paper, borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
          <T w="monoBold" style={{ color: C.paper, fontSize: 13 }}>МЗ</T>
        </View>
        <T w="display" style={{ color: C.paper, fontSize: 16 }}>Машин зар</T>
      </View>
      <View style={{ flex: 1, justifyContent: "center", gap: 28 }}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ backgroundColor: C.yellow, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
              <T w="monoBold" style={{ fontSize: 13 }}>2016+</T>
            </View>
            <View style={{ borderWidth: 1.5, borderColor: "#3A3F47", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <T w="mono" style={{ fontSize: 13, color: "#C9CDD3" }}>2016-аас өмнө</T>
            </View>
          </View>
          <T w="display" style={{ color: C.paper, fontSize: 32, lineHeight: 38 }}>Машинаа зар.{"\n"}Дараагийнхаа машиныг ол.</T>
          <T style={{ color: C.pale, fontSize: 16, lineHeight: 24 }}>Улсын болон арлын дугаартай, 16 хүртэл зурагтай, менежерээр шалгагдсан зарууд.</T>
        </View>
      </View>
      <View style={{ gap: 14 }}>
        {err && (
          <View accessibilityRole="alert" style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 12 }}>
            <T style={{ color: "#9B1C1C", fontSize: 14 }}>Нэвтэрч чадсангүй: {err}</T>
          </View>
        )}
        <Button
          title="Google-ээр нэвтрэх"
          accessibilityHint="Зар тавих, хадгалах, лизингийн хүсэлт илгээхэд нэвтэрнэ"
          icon="log-in"
          loading={busy}
          style={{ backgroundColor: C.paper }}
          variant="ghost"
          onPress={async () => {
            setBusy(true);
            setErr(null);
            try {
              await signInWithGoogle();
            } catch (e) {
              setErr(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button title="Нэвтрэлгүйгээр зар үзэх" variant="darkGhost" onPress={skip} />
        <T style={{ textAlign: "center", fontSize: 13, color: "#9AA0A9", lineHeight: 20 }}>
          Нэвтэрснээр{" "}
          <T style={{ color: C.yellow, fontSize: 13 }} onPress={() => Linking.openURL("https://web-mu-fawn-45.vercel.app")}>үйлчилгээний нөхцөл</T>{" "}
          болон нууцлалын бодлогыг зөвшөөрнө.
        </T>
      </View>
    </View>
  );
}
