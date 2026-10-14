import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/theme";
import { T } from "@/components/ui";

/** Мөр доторх тод үг: эцэг текстийн хэмжээ, өнгийг хадгална */
export function Strong({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: F.bold }}>{children}</Text>;
}

export function Chips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
      {Object.entries(options).map(([key, label]) => {
        const on = value === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(key)}
            style={{
              height: 38,
              paddingHorizontal: 14,
              borderRadius: 19,
              backgroundColor: on ? C.ink : C.card,
              borderWidth: on ? 0 : 1,
              borderColor: C.line2,
              justifyContent: "center",
            }}
          >
            <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <Chips
      value={value === null ? "" : value ? "y" : "n"}
      onChange={(v) => onChange(v === "y")}
      options={{ y: "Тийм", n: "Үгүй" }}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
    >
      <Feather name={checked ? "check-square" : "square"} size={22} color={C.ink} />
      <View style={{ flex: 1, paddingTop: 2 }}>{children}</View>
    </Pressable>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children: React.ReactNode }) {
  const bg = tone === "ok" ? C.activeBg : tone === "warn" ? C.pendingBg : C.dangerBg;
  const fg = tone === "ok" ? C.activeFg : tone === "warn" ? C.pendingFg : "#9B1C1C";
  return (
    <View style={{ backgroundColor: bg, borderRadius: 12, padding: 12 }}>
      <T style={{ fontSize: 13, lineHeight: 19, color: fg }}>{children}</T>
    </View>
  );
}

export function Summary({ items }: { items: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <View
      style={{
        backgroundColor: C.ink,
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: 10,
      }}
    >
      {items.map((x) => (
        <View key={x.label} style={{ width: "50%", gap: 2 }}>
          <T style={{ fontSize: 11, color: C.pale }}>{x.label}</T>
          <T w="bold" style={{ fontSize: x.strong ? 16 : 14, color: x.strong ? C.yellow : C.paper }}>
            {x.value}
          </T>
        </View>
      ))}
    </View>
  );
}

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View
      style={{ flexDirection: "row", gap: 4 }}
      accessibilityLabel={`Алхам ${current + 1} / ${steps.length}: ${steps[current]}`}
    >
      {steps.map((t, i) => (
        <View key={t} style={{ flex: 1, gap: 4 }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= current ? C.ink : C.line2 }} />
          <T
            w={i === current ? "semibold" : "body"}
            style={{ fontSize: 10.5, color: i === current ? C.ink : C.muted }}
            numberOfLines={1}
          >
            {t}
          </T>
        </View>
      ))}
    </View>
  );
}
