import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C } from "@/lib/theme";

export function IconBtn({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.line2,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Feather name={icon} size={20} color={C.ink} />
    </Pressable>
  );
}
