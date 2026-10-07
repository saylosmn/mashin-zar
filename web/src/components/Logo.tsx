import Link from "next/link";

export function Logo({ dark = true, sub, href = "/" }: { dark?: boolean; sub?: string; href?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 no-underline ${dark ? "text-paper" : "text-ink"}`}>
      <span
        className={`mono flex items-center justify-center w-[42px] h-7 rounded-md border-2 text-[12px] font-bold ${
          sub ? "border-yellow text-yellow" : dark ? "border-paper" : "border-ink"
        }`}
      >
        МЗ
      </span>
      <span className="flex flex-col leading-tight">
        <span className="h-display text-[15px]">Машин зар</span>
        {sub && <span className="text-[12px] text-yellow font-normal">{sub}</span>}
      </span>
    </Link>
  );
}
