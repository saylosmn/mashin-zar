"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Одоогийн хуудас руу буцаж ирэхээр нэвтрэх хуудас руу үсрэх холбоос. */
export function LoginLink({ className, children }: { className?: string; children: ReactNode }) {
  const path = usePathname() || "/";
  const href = path === "/" || path === "/login" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
