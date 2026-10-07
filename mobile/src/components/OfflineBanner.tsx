import { View } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { Feather } from "@expo/vector-icons";
import { T } from "./ui";

export function OfflineBanner() {
  const net = useNetInfo();
  if (net.isConnected !== false) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: "#FFEBD6", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#F5C9A0" }}>
      <Feather name="wifi-off" size={18} color="#6B3000" />
      <T w="semibold" style={{ color: "#6B3000", fontSize: 13, flex: 1 }}>Интернэт холболт алга. Холболт сэргэмэгц шинэчлэгдэнэ.</T>
    </View>
  );
}
