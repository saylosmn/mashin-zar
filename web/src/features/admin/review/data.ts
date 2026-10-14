import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChatLead, Lead, PaymentInfo, ReviewAd } from "./types";

const AD_SELECT = "*, owner:profiles!ads_user_id_fkey(full_name,email,phone,city)";

export type ReviewTab = "pending" | "contacted" | "rejected";

export async function reviewQueue(tab: ReviewTab) {
  const supabase = await createClient();
  let q = supabase.from("ads").select(AD_SELECT).order("created_at", { ascending: false }).limit(100);
  if (tab === "pending") q = q.eq("status", "pending").is("contacted_at", null);
  if (tab === "contacted") q = q.eq("status", "pending").not("contacted_at", "is", null);
  if (tab === "rejected") q = q.eq("status", "rejected");
  const count = (contacted: boolean) => {
    const c = supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "pending");
    return contacted ? c.not("contacted_at", "is", null) : c.is("contacted_at", null);
  };
  const [{ data }, waiting, contacted] = await Promise.all([q, count(false), count(true)]);
  return { ads: (data ?? []) as ReviewAd[], counts: { pending: waiting.count ?? 0, contacted: contacted.count ?? 0 } };
}

export async function adById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("ads").select(AD_SELECT).eq("id", id).maybeSingle();
  return (data as ReviewAd | null) ?? null;
}

/** Сонгосон зарын нэмэлт мэдээлэл: сонирхсон хүмүүс, чат, төлбөр, худалдагчийн бусад зар */
export async function adDetails(ad: ReviewAd) {
  const supabase = await createClient();
  const [leads, chats, payment, sellerAds] = await Promise.all([
    supabase
      .from("ad_phone_views")
      .select("user_id,last_at,times, user:profiles!ad_phone_views_user_id_fkey(full_name,phone)")
      .eq("ad_id", ad.id)
      .order("last_at", { ascending: false })
      .limit(50),
    supabase
      .from("conversations")
      .select("id,last_message_at,last_message, buyer:profiles!conversations_buyer_id_fkey(full_name)")
      .eq("ad_id", ad.id)
      .order("last_message_at", { ascending: false })
      .limit(50),
    ad.plan === "paid"
      ? supabase
          .from("payments")
          .select("status,ref,amount")
          .eq("ad_id", ad.id)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("ads").select("status").eq("user_id", ad.user_id),
  ]);
  const own = sellerAds.data ?? [];
  return {
    leads: (leads.data ?? []) as unknown as Lead[],
    chats: (chats.data ?? []) as unknown as ChatLead[],
    payment: (payment.data as PaymentInfo | null) ?? null,
    sellerStats: { total: own.length, sold: own.filter((x) => x.status === "sold").length },
  };
}
