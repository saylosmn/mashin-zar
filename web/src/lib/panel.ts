import "server-only";
import { createClient } from "./supabase/server";

export async function pendingCount() {
  const supabase = await createClient();
  const { count } = await supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

export function monthStarts(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1));
}
