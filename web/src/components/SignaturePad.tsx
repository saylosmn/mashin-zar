"use client";

import { useEffect, useRef, useState } from "react";

const W = 600;
const H = 200;

/**
 * Гарын үсэг зурах талбай (хулгана, хуруу, үзэг). Үр дүнг 600x200 талбайн SVG path болгон буцаана —
 * апп-ын гарын үсэгтэй ижил формат тул PDF-д адилхан зурагдана.
 */
export function SignaturePad({ onChange }: { onChange: (svg: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<[number, number][][]>([]);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#0d1f73";
  }, []);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * H * 10) / 10];
  };

  const emit = () => {
    const path = strokes.current
      .filter((s) => s.length > 0)
      .map((s) => (s.length === 1 ? `M ${s[0][0]} ${s[0][1]} L ${s[0][0] + 0.5} ${s[0][1] + 0.5}` : `M ${s[0][0]} ${s[0][1]} ` + s.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(" ")))
      .join(" ");
    const total = strokes.current.reduce((n, s) => n + s.length, 0);
    onChange(total >= 8 ? path : null);
    setEmpty(total === 0);
  };

  const clear = () => {
    strokes.current = [];
    canvas.current!.getContext("2d")!.clearRect(0, 0, W, H);
    emit();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl border-2 border-dashed border-line-2 bg-[#fbfbf9] overflow-hidden">
        <canvas
          ref={canvas}
          aria-label="Гарын үсэг зурах талбай"
          className="block w-full aspect-[3/1] touch-none cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const p = point(e);
            strokes.current.push([p]);
            const ctx = canvas.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(p[0] + 0.5, p[1] + 0.5);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const s = strokes.current[strokes.current.length - 1];
            const p = point(e);
            const last = s[s.length - 1];
            if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 2) return;
            s.push(p);
            const ctx = canvas.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(last[0], last[1]);
            ctx.lineTo(p[0], p[1]);
            ctx.stroke();
          }}
          onPointerUp={() => {
            drawing.current = false;
            emit();
          }}
          onPointerCancel={() => {
            drawing.current = false;
            emit();
          }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] text-muted">
            Энд хуруу эсвэл хулганаар гарын үсгээ зурна уу
          </span>
        )}
        <span className="pointer-events-none absolute left-[6%] right-[6%] bottom-[22%] border-b border-line-2" />
      </div>
      <button type="button" onClick={clear} className="self-end bg-transparent border-0 p-0 text-[13px] underline text-muted cursor-pointer">
        Арилгаж дахин зурах
      </button>
    </div>
  );
}
