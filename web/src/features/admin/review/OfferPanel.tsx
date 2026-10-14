import { money, timeAgo } from "@/lib/format";
import { saveNote, sendOffer, setAdAgent } from "@/actions/ads";
import type { AgentOption } from "@/components/SaleReportForm";
import type { ChatLead, Lead, ReviewAd } from "./types";

/** Хар хэсэг: санал илгээх, тэмдэглэл, сонирхсон хүмүүс, агент оноох */
export function OfferPanel({
  ad,
  percent,
  back,
  leads,
  chats,
  agents,
}: {
  ad: ReviewAd;
  percent: number | null;
  back: string;
  leads: Lead[];
  chats: ChatLead[];
  agents: AgentOption[];
}) {
  const offer = percent != null ? Math.round((ad.price * percent) / 100) : null;
  const hidden = (
    <>
      <input type="hidden" name="id" value={ad.id} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-ink p-5 text-paper">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="h-display text-[16px]">Хэрэглэгчид тавих санал</span>
        <span className="text-[12px] text-pale">Хувийг «Тохиргоо»-нд</span>
      </div>
      <div className="mono flex flex-wrap items-center gap-3 text-[15px]">
        <span>{money(ad.price)}</span>
        <span className="text-pale">×</span>
        <span className="rounded-md bg-yellow px-2.5 py-1 font-bold text-ink">
          {percent != null ? `${percent}%` : "—%"}
        </span>
        <span className="text-pale">=</span>
        <span className="h-display text-[22px] text-yellow">{offer != null ? money(offer) : "Тохируулаагүй"}</span>
      </div>
      {ad.offer_sent_at && (
        <span className="text-[13px] text-pale">
          Илгээсэн: {money(ad.offer_amount)} · {timeAgo(ad.offer_sent_at)}
        </span>
      )}
      <form action={sendOffer}>
        {hidden}
        <button disabled={percent == null} className="btn btn-yellow">
          {ad.offer_sent_at ? "Саналыг дахин илгээх" : "Санал илгээх"}
        </button>
      </form>
      <form action={saveNote} className="flex flex-col gap-2">
        {hidden}
        <label className="label text-paper">
          Тэмдэглэл
          <textarea
            name="note"
            defaultValue={ad.manager_note ?? ""}
            placeholder="Ярианы тэмдэглэл, хэрэглэгчийн хариу..."
            className="textarea min-h-[70px] border-ink-line bg-ink-2 font-normal text-paper"
          />
        </label>
        <button className="btn btn-sm btn-dark-ghost self-start">Тэмдэглэл хадгалах</button>
      </form>
      <details className="rounded-xl bg-ink-2 px-3.5 py-2.5">
        <summary className="cursor-pointer text-[14px] font-semibold">
          Сонирхсон: {leads.length} хүн утас харсан · {chats.length} чат
        </summary>
        <div className="flex flex-col gap-1.5 pt-2.5 text-[13px]">
          {leads.map((l) => (
            <div key={l.user_id} className="flex justify-between gap-2">
              <span>
                {l.user?.full_name ?? "Хэрэглэгч"}{" "}
                {l.user?.phone && (
                  <a href={`tel:${l.user.phone}`} className="mono text-yellow">
                    {l.user.phone}
                  </a>
                )}
              </span>
              <span className="whitespace-nowrap text-pale">
                {timeAgo(l.last_at)}
                {l.times > 1 ? ` · ${l.times}×` : ""}
              </span>
            </div>
          ))}
          {chats.map((c) => (
            <a key={c.id} href={`/messages/${c.id}`} className="flex justify-between gap-2 no-underline">
              <span className="truncate">
                💬 {c.buyer?.full_name ?? "Худалдан авагч"}: {c.last_message ?? ""}
              </span>
              <span className="whitespace-nowrap text-pale">{timeAgo(c.last_message_at)}</span>
            </a>
          ))}
          {!leads.length && !chats.length && <span className="text-pale">Одоогоор алга.</span>}
        </div>
      </details>
      {agents.length > 0 && (
        <form action={setAdAgent} className="flex flex-wrap items-end gap-2">
          {hidden}
          <label className="label flex-[1_1_200px] text-paper">
            Агент
            <select
              name="agent_id"
              defaultValue={ad.agent_id ?? ""}
              className="input h-10 border-ink-line bg-ink-2 font-normal text-paper"
            >
              <option value="">Агентгүй</option>
              {agents.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-sm btn-dark-ghost">Хадгалах</button>
        </form>
      )}
    </div>
  );
}
