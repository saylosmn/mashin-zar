import type { ContractTerms } from "@shared/contract";

export type Report = {
  id: string;
  ad_id: string;
  sold_price: number;
  sold_at: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  note: string | null;
  days_on_market: number;
  commission_percent: number;
  commission_amount: number;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  ad: {
    id: string;
    brand: string;
    model: string;
    year_made: number;
    plate_number: string;
    contract_id: string | null;
  } | null;
  author: { full_name: string | null; email: string | null } | null;
  agent_id?: string | null;
  agent_amount?: number | null;
  agent_share?: number | null;
  agent_paid_at?: string | null;
  agent?: { full_name: string | null; agent_code: string | null } | null;
};

export type AdOpt = {
  id: string;
  brand: string;
  model: string;
  year_made: number;
  plate_number: string;
  price: number;
  approved_at: string | null;
  created_at: string;
  terms: ContractTerms;
  agent_id?: string | null;
};

export type AgentOpt = { id: string; full_name: string | null; agent_code: string | null };
