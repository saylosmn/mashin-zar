import { Image, View } from "react-native";
import { C } from "@/lib/theme";
import { T } from "./ui";

const MARK = require("../../assets/logo-mark.png");

/** Autoshop.mn тэмдэг: «A» үсэг = алс руу одох зам */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={MARK}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    />
  );
}

/** «Autoshop» + шар «.mn» */
export function Wordmark({ size = 15, color = C.ink }: { size?: number; color?: string }) {
  return (
    <T w="display" style={{ fontSize: size, color }} accessibilityLabel="Autoshop.mn">
      Autoshop
      <T w="display" style={{ fontSize: size, color: C.yellow }}>
        .mn
      </T>
    </T>
  );
}

export function BrandRow({ size = 15, color = C.ink, mark = 30 }: { size?: number; color?: string; mark?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <LogoMark size={mark} />
      <Wordmark size={size} color={color} />
    </View>
  );
}
