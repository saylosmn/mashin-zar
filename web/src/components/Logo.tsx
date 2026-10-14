import Link from "next/link";

/** Autoshop.mn тэмдэг: «A» үсэг = алс руу одох зам (шар хөвөө, цагаан тасархай шугам). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <rect width="64" height="64" rx="14" fill="#111317" />
      <polyline
        points="14,50 32,13 50,50"
        fill="none"
        stroke="#F5B800"
        strokeWidth="8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M32 41.5 V48.5" stroke="#F3F4F1" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 31.5 V35.5" stroke="#F3F4F1" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 25.2 V27.2" stroke="#F3F4F1" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** «Autoshop» + шар «.mn» */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`h-display ${className}`}>
      Autoshop<span className="text-yellow">.mn</span>
    </span>
  );
}

export function Logo({ dark = true, sub, href = "/" }: { dark?: boolean; sub?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Autoshop.mn — нүүр хуудас"
      className={`flex items-center gap-2.5 no-underline ${dark ? "text-paper" : "text-ink"}`}
    >
      <LogoMark size={34} className={`shrink-0 rounded-[9px] ${dark ? "ring-1 ring-ink-line" : ""}`} />
      <span className="flex flex-col leading-tight">
        <Wordmark className="text-[15px]" />
        {sub && <span className="text-[12px] font-normal text-yellow">{sub}</span>}
      </span>
    </Link>
  );
}
