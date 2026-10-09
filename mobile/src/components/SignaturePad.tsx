import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, View, type LayoutChangeEvent } from "react-native";
import { C } from "@/lib/theme";
import { T } from "./ui";

const W = 600;
const H = 200;
type Pt = [number, number];

/**
 * Гарын үсэг зурах талбай (хуруугаар). Шинэ native сан шаардахгүй — зураасыг жижиг View-уудаар зурна.
 * Үр дүн нь вэбтэй ижил: 600x200 талбайн SVG path (PDF-д зурагдана).
 */
export function SignaturePad({ onChange, onDrawing }: { onChange: (svg: string | null) => void; onDrawing?: (active: boolean) => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [strokes, setStrokes] = useState<Pt[][]>([]);
  const cur = useRef<Pt[] | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const toPad = (x: number, y: number): Pt => {
    const { w, h } = sizeRef.current;
    return [Math.round((x / Math.max(w, 1)) * W * 10) / 10, Math.round((y / Math.max(h, 1)) * H * 10) / 10];
  };

  const emit = (all: Pt[][]) => {
    const total = all.reduce((n, s) => n + s.length, 0);
    const path = all
      .map((s) => (s.length === 1 ? `M ${s[0][0]} ${s[0][1]} L ${s[0][0] + 0.5} ${s[0][1] + 0.5}` : `M ${s[0][0]} ${s[0][1]} ` + s.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ")))
      .join(" ");
    onChange(total >= 8 ? path : null);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          onDrawing?.(true);
          cur.current = [toPad(e.nativeEvent.locationX, e.nativeEvent.locationY)];
          setStrokes((s) => [...s, cur.current!]);
        },
        onPanResponderMove: (e) => {
          if (!cur.current) return;
          const p = toPad(e.nativeEvent.locationX, e.nativeEvent.locationY);
          const last = cur.current[cur.current.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 4) return;
          cur.current = [...cur.current, p];
          const stroke = cur.current;
          setStrokes((s) => [...s.slice(0, -1), stroke]);
        },
        onPanResponderRelease: () => {
          cur.current = null;
          onDrawing?.(false);
          setStrokes((s) => {
            emit(s);
            return s;
          });
        },
        onPanResponderTerminate: () => {
          cur.current = null;
          onDrawing?.(false);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sx = size.w / W;
  const sy = size.h / H;
  const segments: { key: string; left: number; top: number; len: number; angle: number }[] = [];
  strokes.forEach((s, i) => {
    if (s.length === 1) segments.push({ key: `${i}-0`, left: s[0][0] * sx - 1.5, top: s[0][1] * sy - 1.5, len: 3, angle: 0 });
    for (let j = 1; j < s.length; j++) {
      const x1 = s[j - 1][0] * sx, y1 = s[j - 1][1] * sy, x2 = s[j][0] * sx, y2 = s[j][1] * sy;
      const len = Math.hypot(x2 - x1, y2 - y1) + 2;
      segments.push({ key: `${i}-${j}`, left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1.5, len, angle: Math.atan2(y2 - y1, x2 - x1) });
    }
  });

  return (
    <View style={{ gap: 6 }}>
      <View
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          setSize({ w, h: w / 3 });
        }}
        style={{ width: "100%", aspectRatio: 3, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: C.line2, backgroundColor: "#FBFBF9", overflow: "hidden" }}
        {...pan.panHandlers}
      >
        <View pointerEvents="none" style={{ position: "absolute", left: "6%", right: "6%", bottom: "22%", borderBottomWidth: 1, borderColor: C.line2 }} />
        {strokes.length === 0 && (
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
            <T style={{ color: C.muted, fontSize: 13 }}>Энд хуруугаараа гарын үсгээ зурна уу</T>
          </View>
        )}
        {segments.map((g) => (
          <View
            key={g.key}
            pointerEvents="none"
            style={{ position: "absolute", left: g.left, top: g.top, width: g.len, height: 3, borderRadius: 1.5, backgroundColor: "#0D1F73", transform: [{ rotate: `${g.angle}rad` }] }}
          />
        ))}
      </View>
      <Pressable onPress={() => { setStrokes([]); onChange(null); }} hitSlop={8} style={{ alignSelf: "flex-end" }}>
        <T style={{ fontSize: 13, color: C.muted, textDecorationLine: "underline" }}>Арилгаж дахин зурах</T>
      </Pressable>
    </View>
  );
}
