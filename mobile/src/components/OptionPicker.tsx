import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/theme";
import { OPTION_GROUPS } from "@/lib/cars";
import { Button, Input, T } from "./ui";

/** Машины опшн сонгох: хайлт + бүлгүүд + өөрийн опшн */
export function OptionPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(OPTION_GROUPS[0].title);
  const [custom, setCustom] = useState("");
  const known = useMemo(() => new Set(OPTION_GROUPS.flatMap((g) => g.items)), []);
  const extra = value.filter((v) => !known.has(v));
  const term = q.trim().toLowerCase();
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const addCustom = () => {
    const c = custom.trim();
    if (c && !value.includes(c)) onChange([...value, c]);
    setCustom("");
  };

  const chip = (o: string) => {
    const on = value.includes(o);
    return (
      <Pressable
        key={o}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        onPress={() => toggle(o)}
        style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: on ? C.ink : C.card, borderWidth: on ? 0 : 1, borderColor: C.line2, flexDirection: "row", alignItems: "center", gap: 5 }}
      >
        {on && <Feather name="check" size={13} color={C.yellow} />}
        <T style={{ fontSize: 13, color: on ? C.paper : C.ink }}>{o}</T>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line2, borderRadius: 12, paddingHorizontal: 12, height: 44 }}>
        <Feather name="search" size={16} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Опшн хайх (камер, люк...)" placeholderTextColor="#9AA0A9" style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0 }} />
        <T style={{ fontSize: 12, color: C.muted }}>{value.length} сонгосон</T>
      </View>

      {term ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {OPTION_GROUPS.flatMap((g) => g.items).filter((o) => o.toLowerCase().includes(term)).map(chip)}
        </View>
      ) : (
        <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: "hidden", backgroundColor: C.card }}>
          {OPTION_GROUPS.map((g, i) => {
            const n = g.items.filter((o) => value.includes(o)).length;
            const isOpen = open === g.title;
            return (
              <View key={g.title} style={{ borderTopWidth: i ? 1 : 0, borderColor: C.line }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : g.title)} style={{ height: 46, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <T w="semibold" style={{ flex: 1, fontSize: 14 }}>{g.title} <T style={{ color: C.muted, fontSize: 13 }}>· {g.items.length}</T></T>
                  {n > 0 && (
                    <View style={{ backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
                      <T w="monoBold" style={{ color: C.yellow, fontSize: 11 }}>{n}</T>
                    </View>
                  )}
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
                </Pressable>
                {isOpen && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>{g.items.map(chip)}</View>}
              </View>
            );
          })}
        </View>
      )}

      {extra.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{extra.map(chip)}</View>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Input value={custom} onChangeText={setCustom} placeholder="+ Жагсаалтад байхгүй опшн" style={{ flex: 1, height: 44 }} onSubmitEditing={addCustom} />
        <Button small title="Нэмэх" variant="ghost" style={{ height: 44 }} onPress={addCustom} />
      </View>
    </View>
  );
}
