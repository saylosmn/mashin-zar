import { Pressable, View } from "react-native";
import { C } from "@/lib/theme";
import { T } from "./ui";

/** Жижиг "нэр: утга" нүд (хүсэлт, тайлангийн карт дотор) */
export function Cell({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "30%",
        backgroundColor: strong ? C.ink : C.paper,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
      }}
    >
      <T style={{ fontSize: 10.5, color: strong ? C.pale : C.muted }}>{k}</T>
      <T w="bold" style={{ fontSize: 13, color: strong ? C.yellow : C.ink }}>
        {v}
      </T>
    </View>
  );
}

export function Kpi({
  label,
  value,
  sub,
  dark,
  onPress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  dark?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: "45%",
        backgroundColor: dark ? C.ink : C.card,
        borderWidth: dark ? 0 : 1,
        borderColor: C.line,
        borderRadius: 14,
        padding: 14,
        gap: 4,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <T style={{ fontSize: 12, color: dark ? C.pale : C.muted }} numberOfLines={1}>
        {label}
      </T>
      <T w="display" style={{ fontSize: 22, color: dark ? C.yellow : C.ink }}>
        {value}
      </T>
      {sub ? (
        <T style={{ fontSize: 11, color: dark ? C.pale : C.muted }} numberOfLines={1}>
          {sub}
        </T>
      ) : null}
    </Pressable>
  );
}
