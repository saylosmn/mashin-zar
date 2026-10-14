import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";
import { money, timeAgo } from "@/lib/format";
import type { StaffAd } from "@/lib/staff";
import { staffAdCache } from "@/lib/cache";
import { Photo, StatusBadge, T, s } from "@/components/ui";

export function AdRow({ a }: { a: StaffAd }) {
  return (
    <Pressable
      onPress={() => {
        staffAdCache.set(a.id, a);
        router.push(`/panel/ad/${a.id}`);
      }}
      style={({ pressed }) => [s.card, { padding: 12, flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 }]}
    >
      <Photo path={a.photos[0]} style={{ width: 76, height: 76, borderRadius: 10 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <T w="semibold" style={{ fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
            {a.brand} {a.model} · {a.year_made}
          </T>
        </View>
        <T w="display" style={{ fontSize: 15 }}>
          {money(a.price)}
        </T>
        <T style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
          {a.owner?.full_name ?? "Нэргүй"} · {a.phone} ·{" "}
          {timeAgo(a.status === "sold" && a.sold_at ? a.sold_at : a.created_at)}
        </T>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
          {a.status !== "pending" && <StatusBadge s={a.status} />}
          {a.contacted_at && <Tag text="Холбогдсон" />}
          {a.offer_amount != null && <Tag text={`Санал ${money(a.offer_amount)}`} strong />}
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={C.pale} style={{ alignSelf: "center" }} />
    </Pressable>
  );
}

function Tag({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: strong ? C.pendingBg : C.soft,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
      }}
    >
      <T w="semibold" style={{ fontSize: 11, color: strong ? C.pendingFg : C.body }}>
        {text}
      </T>
    </View>
  );
}
