import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import { money } from "@/lib/format";
import { Button, Photo, StatusBadge, T, s } from "@/components/ui";

export default function Success() {
  const { title, price, cover, dealer } = useLocalSearchParams<{ title?: string; price?: string; cover?: string; dealer?: string }>();
  const live = dealer === "1";
  return (
    <View style={{ flex: 1, backgroundColor: C.paper, padding: 20, paddingTop: 40, paddingBottom: 32 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }}>
        <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: C.yellow, alignItems: "center", justifyContent: "center" }}>
          <Feather name="check" size={48} color={C.ink} />
        </View>
        <View style={{ gap: 10, alignItems: "center" }}>
          <T w="display" style={{ fontSize: 25, textAlign: "center" }}>{live ? "Зар нийтлэгдлээ" : "Зар амжилттай үүслээ"}</T>
          <T style={{ fontSize: 16, lineHeight: 24, color: C.body, textAlign: "center" }}>{live ? "Таны зар бүх хэрэглэгчид шууд харагдаж байна." : "Манай менежер удахгүй тантай холбогдоно.\nШалгагдсаны дараа зар нийтлэгдэнэ."}</T>
        </View>
        <View style={[s.card, { flexDirection: "row", gap: 12, padding: 12, alignSelf: "stretch", alignItems: "center" }]}>
          <Photo path={cover} style={{ width: 76, height: 76, borderRadius: 10 }} />
          <View style={{ gap: 4, flex: 1 }}>
            <T w="semibold" numberOfLines={1}>{title}</T>
            <T w="display" style={{ fontSize: 15 }}>{money(Number(price))}</T>
            <StatusBadge s={live ? "active" : "pending"} />
          </View>
        </View>
        {!live && <View style={{ alignSelf: "stretch", gap: 4 }}>
          {[["1", "Зар илгээгдсэн", "done"], ["2", "Менежер холбогдож шалгана", "now"], ["3", "Зар нийтлэгдэж, бүх хэрэглэгчид мэдэгдэнэ", "next"]].map(([n, t, st]) => (
            <View key={n} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: st === "done" ? C.ink : "transparent", borderWidth: st === "done" ? 0 : 2, borderColor: st === "now" ? C.ink : C.pale, alignItems: "center", justifyContent: "center" }}>
                <T w="monoBold" style={{ fontSize: 12, color: st === "done" ? C.yellow : st === "now" ? C.ink : C.muted }}>{n}</T>
              </View>
              <T w={st === "now" ? "semibold" : "body"} style={{ fontSize: 14, color: st === "next" ? C.muted : C.ink }}>{t}</T>
            </View>
          ))}
        </View>}
      </View>
      <View style={{ gap: 10 }}>
        <Button title="Миний зарууд" onPress={() => router.replace("/my")} />
        <Button title="Нүүр хуудас" variant="ghost" onPress={() => router.replace("/")} />
      </View>
    </View>
  );
}
