export type Role = "user" | "manager" | "admin" | "dealer";
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
  created_at: string;
};

export type PublicAd = {
  id: string;
  brand: string;
  model: string;
  trim: string | null;
  plate_masked: string;
  vin_masked: string;
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
  approved_at: string | null;
  created_at: string;
  user_id: string;
  seller_name: string;
  seller_city: string | null;
  seller_ad_count: number;
  seller_shop?: string | null;
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
