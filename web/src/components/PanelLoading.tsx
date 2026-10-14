import { IconSpinner } from "./icons";

/** Панелийн хуудас ачаалагдах зуур шууд харагдах хүрээ (товч дармагц хариу үзүүлнэ). */
export function PanelLoading() {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div
        className="flex w-full gap-2 overflow-hidden bg-ink px-4 py-3 lg:min-h-dvh lg:w-[260px] lg:flex-none lg:flex-col lg:py-6"
        aria-hidden
      >
        <div className="h-9 w-40 rounded-lg bg-ink-2 lg:mb-4" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hidden h-11 rounded-[10px] bg-ink-2/60 lg:block" />
        ))}
      </div>
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-12 sm:px-[clamp(16px,3vw,40px)] lg:pt-7">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-[15px] text-body">
          <IconSpinner size={20} className="text-ink" /> Уншиж байна…
        </div>
        <div aria-hidden className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk h-[104px] rounded-2xl" />
          ))}
        </div>
        <div aria-hidden className="sk h-[280px] rounded-2xl" />
      </main>
    </div>
  );
}
