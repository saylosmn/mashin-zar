import { IconSpinner } from "./icons";

/** Панелийн хуудас ачаалагдах зуур шууд харагдах хүрээ (товч дармагц хариу үзүүлнэ). */
export function PanelLoading() {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <div className="w-full lg:w-[260px] lg:flex-none bg-ink lg:min-h-dvh px-4 py-3 lg:py-6 flex lg:flex-col gap-2 overflow-hidden" aria-hidden>
        <div className="h-9 w-40 rounded-lg bg-ink-2 lg:mb-4" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hidden lg:block h-11 rounded-[10px] bg-ink-2/60" />
        ))}
      </div>
      <main className="flex-1 min-w-0 px-4 sm:px-[clamp(16px,3vw,40px)] pt-5 lg:pt-7 pb-12 flex flex-col gap-5">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-[15px] text-body">
          <IconSpinner size={20} className="text-ink" /> Уншиж байна…
        </div>
        <div aria-hidden className="grid gap-3.5 grid-cols-2 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="sk h-[104px] rounded-2xl" />)}
        </div>
        <div aria-hidden className="sk h-[280px] rounded-2xl" />
      </main>
    </div>
  );
}
