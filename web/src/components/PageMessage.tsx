import type { ReactNode } from "react";

export function PageMessage({
  icon,
  title,
  children,
  actions,
  dark = false,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  dark?: boolean;
}) {
  return (
    <main className={`flex flex-1 items-center justify-center px-6 py-16 ${dark ? "bg-ink text-paper" : ""}`}>
      <div className="flex w-full max-w-[980px] flex-wrap items-center gap-12">
        <div className="flex flex-[1_1_240px] justify-center">{icon}</div>
        <div className="flex flex-[2_1_360px] flex-col gap-4">
          <h1 className="h-display m-0 text-[clamp(28px,4vw,44px)] leading-[1.1]">{title}</h1>
          {children && (
            <div className={`text-[17px] leading-relaxed ${dark ? "text-[#c9cdd3]" : "text-body"}`}>{children}</div>
          )}
          {actions && <div className="flex flex-wrap gap-3 pt-1">{actions}</div>}
        </div>
      </div>
    </main>
  );
}
