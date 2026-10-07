import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const IconBell = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const IconSearch = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconHeart = ({ size, filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? "currentColor" : "none"} {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>
);
export const IconPhone = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2.6} {...p}><path d="M5 12l5 5 9-10" /></svg>
);
export const IconTrash = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IconCamera = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const IconFilter = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconRetry = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
);
export const IconLogin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></svg>
);
export const IconWifiOff = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={2} {...p}><path d="M2 8.5a15 15 0 0 1 4.5-2.8M10 5.1A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 3.2-1.9M15.5 10.4A10 10 0 0 1 19 12M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18" /></svg>
);
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2" /></svg>
);
export const IconUser = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
);
export const IconList = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>
);
export const IconHome = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
);
export const IconSpinner = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg className={`spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="#dde0da" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
export const WarnSign = ({ width = 112 }: { width?: number }) => (
  <svg width={width} height={(width * 100) / 112} viewBox="0 0 112 100" aria-hidden>
    <path d="M56 6 L106 94 H6 Z" fill="#F5B800" stroke="#F5B800" strokeWidth="8" strokeLinejoin="round" />
    <path d="M56 34 V62" stroke="#111317" strokeWidth="9" strokeLinecap="round" />
    <circle cx="56" cy="78" r="5.5" fill="#111317" />
  </svg>
);
