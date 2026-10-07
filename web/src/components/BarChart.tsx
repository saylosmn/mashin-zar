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
        <figcaption className="flex gap-4 text-[13px] text-body flex-wrap">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px]" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="flex gap-3" style={{ height }}>
        <div className="mono flex flex-col justify-between text-[11px] text-muted text-right w-7 pb-[26px]">
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="flex-1 grid gap-3 border-l border-line pl-3" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
          {bars.map((b) => {
            const total = b.values.reduce((a, c) => a + c, 0);
            return (
              <div key={b.label} className="flex flex-col items-center gap-2 group relative" title={b.tip}>
                <div className="w-full max-w-11 flex flex-col justify-end gap-[2px] border-b border-[#c9cdd3]" style={{ height: plotH }}>
                  <span className="mono text-[11px] font-semibold text-center pb-0.5">{total}</span>
                  {(() => {
                    const segs = b.values.map((v, si) => ({ v, si })).filter((s) => s.v > 0).reverse();
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
                <span className="text-[12px] text-muted h-[18px] whitespace-nowrap">{b.label}</span>
                <span role="tooltip" className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full hidden group-hover:block bg-ink text-paper text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap z-10">
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
