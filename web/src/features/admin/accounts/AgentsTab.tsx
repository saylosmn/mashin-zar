import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import { inviteAgent, removeAgent } from "@/actions/accounts";
import type { Profile } from "@shared/types";
import {
  ActionButton,
  BlockButton,
  CancelInvite,
  EmptyRow,
  InviteForm,
  TextField,
  idsOrNone,
  type Invite,
} from "./shared";

export async function AgentsTab({ back, email }: { back: string; email?: string }) {
  const supabase = await createClient();
  const [{ data: agents }, { data: inv }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "agent").order("full_name"),
    supabase.from("staff_invites").select("*").eq("role", "agent").order("created_at", { ascending: false }),
  ]);
  const rows = (agents ?? []) as Profile[];
  const emails = new Set(rows.map((r) => r.email?.toLowerCase()));
  const invites = ((inv ?? []) as Invite[]).filter((i) => !emails.has(i.email.toLowerCase()));
  const ids = idsOrNone(rows.map((r) => r.id));
  const [{ data: ads }, { data: reports }] = await Promise.all([
    supabase.from("ads").select("agent_id,status").in("agent_id", ids),
    supabase
      .from("sale_reports")
      .select("agent_id,agent_amount,agent_paid_at")
      .in("agent_id", ids)
      .eq("status", "approved"),
  ]);

  const stats = new Map<string, { ads: number; sold: number; earned: number; unpaid: number }>();
  const statOf = (id: string) => stats.get(id) ?? { ads: 0, sold: 0, earned: 0, unpaid: 0 };
  for (const a of ads ?? []) {
    const x = statOf(a.agent_id);
    x.ads++;
    if (a.status === "sold") x.sold++;
    stats.set(a.agent_id, x);
  }
  for (const r of reports ?? []) {
    const x = statOf(r.agent_id);
    x.earned += r.agent_amount ?? 0;
    if (!r.agent_paid_at) x.unpaid += r.agent_amount ?? 0;
    stats.set(r.agent_id, x);
  }

  return (
    <>
      <InviteForm
        action={inviteAgent}
        back={back}
        title="Агент нэмэх"
        note="Агент өөрийн код/холбоосоор зар авчирна. Зар зарагдаж тайлан батлагдахад шимтгэлийн тохиргоонд заасан хувь агентад ногдоно (Тохиргоо → Агент)."
        submit="Нэмэх"
      >
        <TextField label="Нэр" name="name" placeholder="Овог нэр" />
        <TextField
          label="Google и-мэйл"
          name="email"
          type="email"
          required
          defaultValue={email}
          placeholder="name@gmail.com"
          basis="220px"
        />
        <TextField label="Утас" name="phone" type="tel" placeholder="9911 2233" basis="150px" />
      </InviteForm>
      <div className="table-wrap">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th>Агент</th>
              <th>Код</th>
              <th>Утас</th>
              <th>Авчирсан зар</th>
              <th>Зарагдсан</th>
              <th>Нийт олсон</th>
              <th>Төлөгдөөгүй</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && invites.length === 0 && (
              <EmptyRow cols={8} text="Одоогоор агент бүртгэгдээгүй байна." />
            )}
            {rows.map((g) => {
              const x = statOf(g.id);
              return (
                <tr key={g.id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-semibold">{g.full_name ?? "—"}</span>
                      <span className="text-[12px] text-muted">{g.email}</span>
                    </div>
                  </td>
                  <td className="mono font-bold">{g.agent_code ?? "—"}</td>
                  <td className="mono">{g.phone ?? "—"}</td>
                  <td className="mono">{x.ads}</td>
                  <td className="mono">{x.sold}</td>
                  <td className="mono">{num(x.earned)}₮</td>
                  <td className="mono font-bold">{x.unpaid ? `${num(x.unpaid)}₮` : "—"}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <BlockButton id={g.id} blocked={g.is_blocked} back={back} />
                      <ActionButton action={removeAgent} fields={{ id: g.id }} back={back} className="btn-ghost">
                        Эрх хасах
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {invites.map((i) => (
              <tr key={i.email}>
                <td className="font-semibold">{i.full_name ?? "—"}</td>
                <td className="mono">—</td>
                <td className="text-body" colSpan={5}>
                  {i.email}
                </td>
                <td>
                  <CancelInvite email={i.email} back={back} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="text-[13px] text-muted">
        Агент нэвтэрмэгц «Агент» цэснээс өөрийн код, урилгын холбоос, орлогоо харна. Төлбөрийг «Тайлангууд» хэсгээс
        төлсөн гэж тэмдэглэнэ.
      </span>
    </>
  );
}
