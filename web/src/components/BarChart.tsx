type Bar = { label: string; values: number[]; tip: string };

/** Энгийн багана график. series: [{name,color}], bars: values series-ийн дарааллаар (доороос дээш овоолно). */
export function BarChart({
  bars,
  series,
  height = 220,
}: {
  bars: Bar[];
  series: { name: string; color: string }[];
  height?: number;
}) {
  const max = Math.max(4, ...bars.map((b) => b.values.reduce((a, c) => a + c, 0)));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => i * step);
  const plotH = height - 26;
  return (
    <figure className="m-0 flex flex-col gap-3">
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-4 text-[13px] text-body">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="flex gap-3" style={{ height }}>
        <div className="mono flex w-7 flex-col justify-between pb-[26px] text-right text-[11px] text-muted">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div
          className="grid flex-1 gap-3 border-l border-line pl-3"
          style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
        >
          {bars.map((b) => {
            const total = b.values.reduce((a, c) => a + c, 0);
            return (
              <div key={b.label} className="group relative flex flex-col items-center gap-2" title={b.tip}>
                <div
                  className="flex w-full max-w-11 flex-col justify-end gap-[2px] border-b border-[#c9cdd3]"
                  style={{ height: plotH }}
                >
                  <span className="mono pb-0.5 text-center text-[11px] font-semibold">{total}</span>
                  {(() => {
                    const segs = b.values
                      .map((v, si) => ({ v, si }))
                      .filter((s) => s.v > 0)
                      .reverse();
                    return segs.map((s, i) => (
                      <div
                        key={s.si}
                        style={{
                          height: Math.max(2, (s.v / top) * (plotH - 18)),
                          background: series[s.si].color,
                          borderRadius: i === 0 ? "4px 4px 0 0" : 0,
                        }}
                      />
                    ));
                  })()}
                </div>
                <span className="h-[18px] text-[12px] whitespace-nowrap text-muted">{b.label}</span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2.5 py-1.5 text-[12px] whitespace-nowrap text-paper group-hover:block"
                >
                  {b.tip}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </figure>
  );
}
