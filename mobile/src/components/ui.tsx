import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { C, F } from "@/lib/theme";
import { STATUS, categoryLabel, money } from "@/lib/format";
import { photoUrl } from "@/lib/supabase";
import type { AdStatus, Category } from "@/lib/types";

export function T({ style, w = "body", ...p }: TextProps & { w?: keyof typeof F }) {
  return <Text {...p} style={[{ fontFamily: F[w], color: C.ink, fontSize: 15 }, style]} />;
}

type BtnVariant = "yellow" | "ink" | "ghost" | "danger" | "darkGhost";
const BTN: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
  yellow: { bg: C.yellow, fg: C.ink },
  ink: { bg: C.ink, fg: C.yellow },
  ghost: { bg: C.card, fg: C.ink, border: C.line2 },
  danger: { bg: C.card, fg: C.danger, border: C.dangerLine },
  darkGhost: { bg: "transparent", fg: C.paper, border: C.inkLine },
};

export function Button({
  title,
  variant = "ink",
  icon,
  loading,
  small,
  style,
  ...p
}: PressableProps & {
  title: string;
  variant?: BtnVariant;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BTN[variant];
  return (
    <Pressable
      accessibilityRole="button"
      {...p}
      disabled={p.disabled || loading}
      style={({ pressed }) => [
        {
          height: small ? 38 : 54,
          paddingHorizontal: small ? 12 : 18,
          borderRadius: small ? 10 : 14,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed || p.disabled ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={small ? 16 : 20} color={v.fg} />}
          <T w="bold" style={{ color: v.fg, fontSize: small ? 13 : 16 }}>
            {title}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function Plate({ text, big }: { text: string; big?: boolean }) {
  return (
    <View style={{ borderWidth: big ? 2 : 1.5, borderColor: C.ink, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: C.card }}>
      <T w="monoBold" style={{ fontSize: big ? 15 : 12 }}>{text}</T>
    </View>
  );
}

export function CatChip({ c, cy }: { c: Category; cy: number }) {
  return (
    <View style={{ backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, alignSelf: "flex-start" }}>
      <T w="monoBold" style={{ color: C.yellow, fontSize: 11 }}>{categoryLabel(c, cy)}</T>
    </View>
  );
}

export function StatusBadge({ s }: { s: AdStatus }) {
  const st = STATUS[s];
  return (
    <View style={{ backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" }}>
      <T w="semibold" style={{ color: st.fg, fontSize: 12 }}>{st.label}</T>
    </View>
  );
}

export function Photo({ path, style, label }: { path?: string | null; style?: StyleProp<ViewStyle>; label?: string }) {
  const url = photoUrl(path);
  if (!url)
    return (
      <View style={[{ backgroundColor: "#E7E8E4", alignItems: "center", justifyContent: "center" }, style]}>
        <T w="mono" style={{ color: C.muted, fontSize: 11 }}>{label ?? "Зураггүй"}</T>
      </View>
    );
  return <Image source={{ uri: url }} style={style as never} contentFit="cover" transition={150} />;
}

export function AdCard({
  ad,
  cy,
  onPress,
}: {
  ad: { brand: string; model: string; trim: string | null; plate_masked: string; year_made: number; year_imported: number | null; price: number; photos: string[]; category: Category; seller_shop?: string | null; featured?: boolean };
  cy: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={[s.card, ad.featured ? { borderWidth: 2, borderColor: C.yellow } : null]}>
      <View>
        <Photo path={ad.photos[0]} style={{ height: 190, width: "100%" }} />
        <View style={{ position: "absolute", left: 12, top: 12 }}><CatChip c={ad.category} cy={cy} /></View>
        {ad.featured ? (
          <View style={{ position: "absolute", right: 12, top: 12, backgroundColor: C.yellow, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="star" size={11} color={C.ink} />
            <T w="bold" style={{ fontSize: 11 }}>Онцлох</T>
          </View>
        ) : null}
        {ad.seller_shop ? (
          <View style={{ position: "absolute", left: 12, bottom: 12, maxWidth: "60%", backgroundColor: C.yellow, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="shopping-bag" size={11} color={C.ink} />
            <T w="bold" style={{ fontSize: 11 }} numberOfLines={1}>{ad.seller_shop}</T>
          </View>
        ) : null}
        {ad.photos.length > 0 && (
          <View style={{ position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(17,19,23,.85)", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
            <T w="mono" style={{ color: C.paper, fontSize: 11 }}>{ad.photos.length} зураг</T>
          </View>
        )}
      </View>
      <View style={{ padding: 16, paddingTop: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <T w="semibold" style={{ fontSize: 17, flexShrink: 1 }} numberOfLines={1}>{ad.brand} {ad.model}</T>
          <Plate text={ad.plate_masked} />
        </View>
        <T style={{ fontSize: 13, color: C.muted }} numberOfLines={1}>
          Үйлд. {ad.year_made}{ad.year_imported ? ` · Орж ирсэн ${ad.year_imported}` : ""}{ad.trim ? ` · ${ad.trim}` : ""}
        </T>
        <T w="display" style={{ fontSize: 19 }}>{money(ad.price)}</T>
      </View>
    </Pressable>
  );
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ backgroundColor: "#E3E5E0", borderRadius: 6, opacity: a }, style]} />;
}

export function CardSkeleton() {
  return (
    <View style={s.card} accessibilityElementsHidden>
      <Skeleton style={{ height: 180, borderRadius: 0 }} />
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Skeleton style={{ width: "55%", height: 16 }} />
          <Skeleton style={{ width: 64, height: 20, borderRadius: 4 }} />
        </View>
        <Skeleton style={{ width: "75%", height: 12 }} />
        <Skeleton style={{ width: "40%", height: 20 }} />
      </View>
    </View>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <T w="semibold" style={{ fontSize: 13 }}>{label}</T>
      {children}
      {error ? <T style={{ fontSize: 12, color: C.danger }}>{error}</T> : hint ? <T style={{ fontSize: 12, color: C.muted }}>{hint}</T> : null}
    </View>
  );
}

export function Input({ style, mono, strong, ...p }: TextInputProps & { mono?: boolean; strong?: boolean }) {
  return (
    <TextInput
      placeholderTextColor="#9AA0A9"
      {...p}
      style={[
        {
          height: p.multiline ? undefined : 50,
          minHeight: p.multiline ? 100 : undefined,
          paddingHorizontal: 14,
          paddingVertical: p.multiline ? 12 : 0,
          borderWidth: strong ? 2 : 1,
          borderColor: strong ? C.ink : C.line2,
          borderRadius: 12,
          backgroundColor: C.card,
          fontFamily: mono ? F.monoBold : F.body,
          fontSize: 15,
          color: C.ink,
          textAlignVertical: p.multiline ? "top" : "center",
        },
        style as StyleProp<TextStyle>,
      ]}
    />
  );
}

export function StateView({
  icon,
  title,
  text,
  dark,
  children,
  iconBg,
  iconColor,
}: {
  icon: keyof typeof Feather.glyphMap | "warning";
  title: string;
  text?: string;
  dark?: boolean;
  children?: ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  const fg = dark ? C.paper : C.ink;
  return (
    <View style={{ flex: 1, backgroundColor: dark ? C.ink : C.paper, padding: 24, paddingTop: 56, paddingBottom: 32 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }}>
        {icon === "warning" ? (
          <View style={{ width: 112, height: 100, alignItems: "center", justifyContent: "flex-end" }}>
            <View style={{ width: 0, height: 0, borderLeftWidth: 56, borderRightWidth: 56, borderBottomWidth: 96, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: C.yellow, position: "absolute", bottom: 0 }} />
            <T w="display" style={{ fontSize: 46, color: C.ink, marginBottom: 6 }}>!</T>
          </View>
        ) : (
          <View style={{ width: 104, height: 104, borderRadius: 28, backgroundColor: iconBg ?? (dark ? C.ink2 : C.card), borderWidth: iconBg ? 0 : 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
            <Feather name={icon} size={46} color={iconColor ?? fg} />
          </View>
        )}
        <View style={{ gap: 10, alignItems: "center" }}>
          <T w="display" style={{ fontSize: 24, color: fg, textAlign: "center", lineHeight: 30 }}>{title}</T>
          {text && <T style={{ fontSize: 15, lineHeight: 23, color: dark ? "#C9CDD3" : C.body, textAlign: "center" }}>{text}</T>}
        </View>
      </View>
      {children && <View style={{ gap: 10 }}>{children}</View>}
    </View>
  );
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  section: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 },
  h2: { fontSize: 16 },
});
