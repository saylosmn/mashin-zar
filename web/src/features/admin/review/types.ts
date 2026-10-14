import type { Ad, PayStatus, Profile } from "@shared/types";

export type ReviewAd = Ad & { owner: Pick<Profile, "full_name" | "email" | "phone" | "city"> | null };

export type Lead = {
  user_id: string;
  last_at: string;
  times: number;
  user: { full_name: string | null; phone: string | null } | null;
};

export type ChatLead = {
  id: string;
  last_message_at: string;
  last_message: string | null;
  buyer: { full_name: string | null } | null;
};

export type PaymentInfo = { status: PayStatus; ref: string; amount: number };
