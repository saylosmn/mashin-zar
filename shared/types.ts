export type Role = "user" | "admin" | "dealer" | "leasing" | "agent";
export type AdStatus = "pending" | "active" | "sold" | "rejected" | "hidden";
export type Category = "new" | "old";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  role: Role;
  is_blocked: boolean;
  shop_name?: string | null;
  partner_id?: string | null;
  agent_code?: string | null;
  profile_completed: boolean;
  notify_new_ads: boolean;
  notify_category: Category | null;
  notify_brand: string | null;
  notify_max_price: number | null;
  created_at: string;
};

export type Ad = {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  trim: string | null;
  plate_number: string;
  vin: string;
  phone: string;
  year_made: number;
  year_imported: number | null;
  options: string[];
  modifications: string | null;
  description: string | null;
  price: number;
  photos: string[];
  category: Category;
  status: AdStatus;
  views: number;
  manager_id: string | null;
  manager_note: string | null;
  contacted_at: string | null;
  offer_percent: number | null;
  offer_amount: number | null;
  offer_sent_at: string | null;
  approved_at: string | null;
  sold_at: string | null;
  sold_price: number | null;
  contract_id?: string | null;
  agent_id?: string | null;
  expires_at?: string | null;
  featured_until?: string | null;
  featured_requested_at?: string | null;
  /** commission = шимтгэлтэй (гэрээтэй), paid = онцлох төлбөртэй (шимтгэлгүй) */
  plan?: Plan;
  created_at: string;
};

export type Plan = "commission" | "paid";
export type PayStatus = "awaiting" | "submitted" | "confirmed" | "rejected" | "cancelled";

export type Payment = {
  id: string;
  ad_id: string | null;
  user_id: string;
  ad_title: string | null;
  amount: number;
  days: number;
  ref: string;
  status: PayStatus;
  payer_note: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  decided_via: "web" | "telegram" | "sms" | null; // telegram: хуучин бичлэг
  decided_name: string | null;
  admin_note: string | null;
  applied_at: string | null;
  created_at: string;
};

export type PublicAd = {
  id: string;
  brand: string;
  model: string;
  trim: string | null;
  plate_masked: string;
  vin_masked: string;
  year_made: number;
  year_imported: number | null;
  options: string[];
  modifications: string | null;
  description: string | null;
  price: number;
  photos: string[];
  category: Category;
  status: AdStatus;
  views: number;
  approved_at: string | null;
  created_at: string;
  user_id: string;
  seller_name: string;
  seller_city: string | null;
  seller_ad_count: number;
  seller_shop?: string | null;
  featured?: boolean;
  expires_at?: string | null;
};

export type Settings = {
  offer_percent: number | null;
  cutoff_year: number;
  max_photos: number;
  min_photos: number;
  ad_days: number;
  notify_all_on_approve: boolean;
  notify_staff_on_new: boolean;
  apk_url?: string | null;
  apk_version?: string | null;
  apk_updated_at?: string | null;
  company_name?: string;
  commission_tiers?: { days: number; percent: number }[];
  commission_after?: number;
  agent_share?: number;
  featured_price?: number;
  featured_days?: number;
  site_url?: string;
  commission_featured_days?: number;
  pay_bank?: string | null;
  pay_account?: string | null;
  pay_holder?: string | null;
};

export type Notification = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  ad_id: string | null;
  read: boolean;
  created_at: string;
};

export type ChatRow = {
  id: string;
  ad_id: string | null;
  car: string;
  photo: string | null;
  price: number | null;
  ad_status: string | null;
  role: "buyer" | "seller";
  other_name: string;
  last_message: string | null;
  last_message_at: string;
  last_from_me: boolean;
  unread: number;
};
export type ChatInfo = {
  id: string;
  ad_id: string | null;
  car: string;
  photo: string | null;
  price: number | null;
  ad_status: string | null;
  role: "buyer" | "seller" | "staff";
  other_name: string;
  other_id: string;
};
export type Message = {
  id: number;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};
