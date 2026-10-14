import Link from "next/link";
import { initial, money } from "@/lib/format";
import { PAY_STATUS } from "@/lib/payments";
import type { PaymentInfo, ReviewAd } from "./types";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px]">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-[1_1_240px] flex-col gap-2.5 rounded-[14px] bg-paper p-4">
      <span className="text-[12px] font-bold tracking-wide text-muted">{title}</span>
      {children}
    </div>
  );
}

export function SellerCard({ ad, stats }: { ad: ReviewAd; stats: { total: number; sold: number } }) {
  const o = ad.owner;
  return (
    <Card title="ЗАР ТАВЬСАН ХҮН">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-bold text-yellow">
          {initial(o?.full_name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{o?.full_name ?? "—"}</span>
          <span className="truncate text-[12px] text-muted">{o?.email}</span>
        </div>
      </div>
      <Line label="Утас (зар)">
        <a href={`tel:${ad.phone}`} className="mono font-bold">
          {ad.phone}
        </a>
      </Line>
      {o?.phone && o.phone !== ad.phone && (
        <Line label="Утас (профайл)">
          <span className="mono font-bold">{o.phone}</span>
        </Line>
      )}
      <Line label="Хот">
        <span>{o?.city ?? "—"}</span>
      </Line>
      <Line label="Нийт зар">
        <span className="font-semibold">
          {stats.total} ({stats.sold} зарагдсан)
        </span>
      </Line>
    </Card>
  );
}

export function VehicleCard({ ad, payment }: { ad: ReviewAd; payment: PaymentInfo | null }) {
  return (
    <Card title="ДУГААР (ЗӨВХӨН АДМИН)">
      <Line label="Улсын">
        <span className="plate text-[16px]">{ad.plate_number}</span>
      </Line>
      <Line label="Арлын">
        <span className="mono font-bold">{ad.vin}</span>
      </Line>
      <Line label="Үйлд. / Орж ирсэн">
        <span className="mono font-bold">
          {ad.year_made} / {ad.year_imported ?? "—"}
        </span>
      </Line>
      <Line label="Опшн">
        <span className="text-right">{ad.options.join(", ") || "—"}</span>
      </Line>
      <Line label={ad.plan === "paid" ? "Төлбөр" : "Гэрээ"}>
        {ad.plan === "paid" ? (
          payment ? (
            <Link href="/admin/payments" className="text-right font-semibold">
              {PAY_STATUS[payment.status].label} · <span className="mono">{payment.ref}</span> · {money(payment.amount)}
            </Link>
          ) : (
            <span className="text-muted">Шимтгэлгүй · төлбөр алга</span>
          )
        ) : ad.contract_id ? (
          <a href={`/api/contracts/${ad.contract_id}/pdf`} target="_blank" rel="noreferrer" className="font-semibold">
            Гарын үсэгтэй PDF ↗
          </a>
        ) : (
          <span className="text-muted">Гэрээгүй (өмнөх зар)</span>
        )}
      </Line>
    </Card>
  );
}
