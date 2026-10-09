"use client";

import type { ButtonHTMLAttributes } from "react";

/** Илгээхээс өмнө баталгаажуулалт асуудаг submit товч (устгах гэх мэт буцаах боломжгүй үйлдэлд). */
export function ConfirmButton({ message, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      type="submit"
      {...p}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
