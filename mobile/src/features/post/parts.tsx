import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "@/lib/theme";
import { Button, T, s } from "@/components/ui";

/** path: storage-д аль хэдийн байгаа зураг (засах үед) */
export type Pic = { uri: string; id: string; path?: string };

/** Дэлгэцийн доор наалттай хэсэг (илгээх товч). Алдааг товчны дээр харуулна. */
export function BottomBar({ error, children }: { error: string | null; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 16),
        backgroundColor: C.card,
        borderTopWidth: 1,
        borderColor: C.line,
        gap: 8,
      }}
    >
      {error ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "flex-start",
            backgroundColor: C.dangerBg,
            borderRadius: 12,
            padding: 10,
          }}
        >
          <Feather name="alert-circle" size={16} color="#9B1C1C" style={{ marginTop: 2 }} />
          <T style={{ color: "#9B1C1C", fontSize: 13.5, lineHeight: 19, flex: 1 }}>{error}</T>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const tile = { width: "23%", aspectRatio: 1, borderRadius: 10 } as const;

function AddTile({ icon, label, onPress }: { icon: "image" | "camera"; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={icon === "camera" ? "Камераар авах" : "Зургийн сангаас нэмэх"}
      style={{
        ...tile,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#9AA0A9",
        backgroundColor: C.card,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Feather name={icon} size={20} color={C.ink} />
      <T style={{ fontSize: 11 }}>{label}</T>
    </Pressable>
  );
}

/** Эхний зураг нүүр зураг. Аль нэг зураг дээр дарвал нүүр болно. */
export function PhotoGrid({
  pics,
  max,
  onChange,
  onPick,
}: {
  pics: Pic[];
  max: number;
  onChange: (pics: Pic[]) => void;
  onPick: (camera: boolean) => void;
}) {
  const makeCover = (i: number) => onChange([pics[i], ...pics.filter((_, j) => j !== i)]);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {pics.map((p, i) => (
        <Pressable
          key={p.id}
          onLongPress={() => makeCover(i)}
          onPress={() => i > 0 && makeCover(i)}
          accessibilityLabel={`Зураг ${i + 1}${i === 0 ? ", нүүр зураг" : ", дарж нүүр болгох"}`}
          style={{ ...tile, overflow: "hidden", borderWidth: i === 0 ? 2 : 0, borderColor: C.ink }}
        >
          <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          {i === 0 && (
            <View
              style={{
                position: "absolute",
                left: 4,
                bottom: 4,
                backgroundColor: C.ink,
                borderRadius: 3,
                paddingHorizontal: 4,
                paddingVertical: 1,
              }}
            >
              <T w="monoBold" style={{ color: C.yellow, fontSize: 9 }}>
                НҮҮР
              </T>
            </View>
          )}
          <Pressable
            accessibilityLabel={`Зураг ${i + 1} хасах`}
            hitSlop={6}
            onPress={() => onChange(pics.filter((q) => q.id !== p.id))}
            style={{
              position: "absolute",
              right: 3,
              top: 3,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "rgba(17,19,23,.8)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={14} color={C.paper} />
          </Pressable>
        </Pressable>
      ))}
      {pics.length < max && (
        <>
          <AddTile icon="image" label="Нэмэх" onPress={() => onPick(false)} />
          <AddTile icon="camera" label="Камер" onPress={() => onPick(true)} />
        </>
      )}
    </View>
  );
}

/** Бичсэн үсгээр эхэлсэн санал (марк, загвар) */
export function Suggestions({
  items,
  query,
  limit,
  onPick,
}: {
  items: string[];
  query: string;
  limit: number;
  onPick: (v: string) => void;
}) {
  const q = query.toLowerCase();
  const list = items.filter((x) => !q || x.toLowerCase().startsWith(q)).slice(0, limit);
  if (!list.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {list.map((x) => (
        <Pressable
          key={x}
          onPress={() => onPick(x)}
          style={{
            paddingHorizontal: 10,
            height: 32,
            borderRadius: 16,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.line2,
            justifyContent: "center",
          }}
        >
          <T style={{ fontSize: 13 }}>{x}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function PlanCard({
  title,
  price,
  points,
  cta,
  onPick,
  highlight = false,
}: {
  title: string;
  price: string;
  points: string[];
  cta: string;
  onPick: () => void;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        s.card,
        { padding: 16, gap: 12, borderWidth: highlight ? 2 : 1, borderColor: highlight ? C.ink : C.line2 },
      ]}
    >
      <View style={{ gap: 4 }}>
        <T w="bold" style={{ fontSize: 17 }}>
          {title}
        </T>
        <T w="display" style={{ fontSize: 15 }}>
          {price}
        </T>
      </View>
      <View style={{ gap: 8 }}>
        {points.map((p) => (
          <View key={p} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.yellow,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <Feather name="check" size={12} color={C.ink} />
            </View>
            <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{p}</T>
          </View>
        ))}
      </View>
      <Button title={cta} variant={highlight ? "ink" : "yellow"} icon="arrow-right" onPress={onPick} />
    </View>
  );
}

/** Илгээж байх үеийн дэлгэц: зургийн явц + 3 алхам */
export function Progress({
  step,
  done,
  total,
  labels,
}: {
  step: 1 | 2 | 3;
  done: number;
  total: number;
  labels: string[];
}) {
  return (
    <View
      style={{ flex: 1, backgroundColor: C.paper, padding: 24, paddingTop: 56, justifyContent: "center", gap: 24 }}
      accessibilityLiveRegion="polite"
    >
      <View style={{ alignItems: "center", gap: 12 }}>
        <Feather name="upload-cloud" size={56} color={C.ink} />
        <T w="display" style={{ fontSize: 22 }}>
          Зар илгээж байна
        </T>
        <T style={{ color: C.body, textAlign: "center" }}>Уншиж байна, түр хүлээнэ үү. Аппаас гаралгүй байгаарай.</T>
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T w="semibold" style={{ fontSize: 14 }}>
            {step === 1 ? "Зураг байршуулж байна" : step === 2 ? "Гэрээ баталгаажуулж байна" : "Зар илгээж байна"}
          </T>
          <T w="monoBold" style={{ fontSize: 14 }}>
            {done} / {total}
          </T>
        </View>
        <View
          accessibilityRole="progressbar"
          style={{ height: 12, borderRadius: 6, backgroundColor: C.line, overflow: "hidden" }}
        >
          <View
            style={{
              width: `${(done / Math.max(total, 1)) * 100}%`,
              height: 12,
              borderRadius: 6,
              backgroundColor: C.yellow,
            }}
          />
        </View>
      </View>
      <View style={[s.section, { gap: 14 }]}>
        {labels.map((label, i) => {
          const on = i === 0 || step > i;
          return (
            <View key={label} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: on ? C.ink : "transparent",
                  borderWidth: on ? 0 : 2,
                  borderColor: C.pale,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {on && <Feather name="check" size={14} color={C.yellow} />}
              </View>
              <T w={i === step - 1 ? "semibold" : "body"} style={{ color: on ? C.ink : C.muted, fontSize: 14 }}>
                {label}
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}
