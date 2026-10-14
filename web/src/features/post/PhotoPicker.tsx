"use client";

import { useRef, useState } from "react";
import { IconCamera, IconClose } from "@/components/icons";

export type Photo = { id: string; file: File; url: string };

/** Зураг сонгох, чирж эрэмбэлэх. Эхний зураг нь нүүр зураг. */
export function PhotoPicker({
  photos,
  onChange,
  max,
  min,
  disabled,
}: {
  photos: Photo[];
  onChange: (p: Photo[]) => void;
  max: number;
  min: number;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const added = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, max - photos.length)
      .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    onChange([...photos, ...added]);
  }

  function move(from: number, to: number) {
    const next = [...photos];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  }

  return (
    <section className="card flex flex-col gap-3.5 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[18px] font-bold">1 · Зураг</h2>
        <span className="mono text-[13px] text-muted">
          {photos.length} / {max}
        </span>
      </div>
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            add(e.dataTransfer.files);
          }
        }}
      >
        {photos.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (dragging !== null && !e.dataTransfer.files.length) {
                e.preventDefault();
                e.stopPropagation();
                move(dragging, i);
                setDragging(null);
              }
            }}
            className={`relative aspect-square cursor-grab overflow-hidden rounded-[10px] bg-soft ${i === 0 ? "outline-2 -outline-offset-2 outline-ink" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- локал blob URL, next/image хэрэггүй */}
            <img src={p.url} alt={`Зураг ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="mono absolute bottom-1.5 left-1.5 rounded bg-ink px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                НҮҮР
              </span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => move(i, 0)}
                className="absolute bottom-1 left-1 cursor-pointer rounded border-0 bg-ink/80 px-1.5 py-1 text-[10px] font-semibold text-paper"
              >
                Нүүр болгох
              </button>
            )}
            <button
              type="button"
              aria-label={`Зураг ${i + 1} хасах`}
              disabled={disabled}
              onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
              className="absolute top-1 right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-ink/80 text-paper"
            >
              <IconClose size={14} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-[#9aa0a9] bg-card text-[12px] text-ink"
          >
            <IconCamera size={22} /> Зураг нэмэх
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="text-[13px] text-muted">
        Чирж оруулах эсвэл сонгох. Эхний зураг нүүр зураг болно («Нүүр болгох» товчоор эсвэл чирж солино). {min}–{max}{" "}
        зураг.
      </span>
    </section>
  );
}
