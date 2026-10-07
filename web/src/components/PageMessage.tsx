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
    <main className={`flex-1 px-6 py-16 flex items-center justify-center ${dark ? "bg-ink text-paper" : ""}`}>
      <div className="w-full max-w-[980px] flex flex-wrap items-center gap-12">
        <div className="flex-[1_1_240px] flex justify-center">{icon}</div>
        <div className="flex-[2_1_360px] flex flex-col gap-4">
          <h1 className="h-display m-0 text-[clamp(28px,4vw,44px)] leading-[1.1]">{title}</h1>
          {children && <div className={`text-[17px] leading-relaxed ${dark ? "text-[#c9cdd3]" : "text-body"}`}>{children}</div>}
          {actions && <div className="flex gap-3 flex-wrap pt-1">{actions}</div>}
        </div>
      </div>
    </main>
  );
}
