import { Pressable } from "react-native";
import { C } from "@/lib/theme";
import { T } from "@/components/ui";

export function Chip({ text, on, onPress }: { text: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={{
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: on ? C.ink : C.card,
        borderWidth: on ? 0 : 1,
        borderColor: C.line2,
        justifyContent: "center",
      }}
    >
      <T w={on ? "semibold" : "body"} style={{ fontSize: 13, color: on ? C.yellow : C.ink }}>
        {text}
      </T>
    </Pressable>
  );
}
