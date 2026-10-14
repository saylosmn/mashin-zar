import { createClient } from "@/lib/supabase/server";
import { initial } from "@/lib/format";
import { inviteStaff, removeStaff } from "@/actions/accounts";
import type { Profile } from "@shared/types";
import {
  AccountStatus,
  ActionButton,
  BlockButton,
  CancelInvite,
  InviteForm,
  PendingInvite,
  TextField,
  newCounts,
  type Counts,
  type Invite,
} from "./shared";

export async function StaffTab({ me, back }: { me: Profile; back: string }) {
  const supabase = await createClient();
  const [{ data: admins }, { data: inv }, { data: reviewed }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "admin").order("created_at"),
    supabase.from("staff_invites").select("*").eq("role", "admin").order("created_at", { ascending: false }),
    supabase.from("ads").select("manager_id,status").not("manager_id", "is", null),
  ]);
  const rows = (admins ?? []) as Profile[];
  const emails = new Set(rows.map((r) => r.email?.toLowerCase()));
  const invites = ((inv ?? []) as Invite[]).filter((i) => !emails.has(i.email.toLowerCase()));
  const counts = new Map<string, Counts>();
  for (const a of reviewed ?? []) {
    const c = counts.get(a.manager_id!) ?? newCounts();
    if (a.status === "active" || a.status === "sold") c.approved++;
    if (a.status === "sold") c.sold++;
    counts.set(a.manager_id!, c);
  }

  return (
    <>
      <InviteForm
        action={inviteStaff}
        back={back}
        title="Шинэ админ нэмэх"
        note="Админ бүх эрхтэй: зар батлах, төлбөр, тайлан, аккаунт, тохиргоо. Зөвхөн итгэлтэй хүнд олгоно уу."
        submit="Админ нэмэх"
      >
        <TextField label="Нэр" name="name" placeholder="Овог нэр" />
        <TextField
          label="Google и-мэйл"
          name="email"
          type="email"
          required
          placeholder="name@gmail.com"
          basis="220px"
        />
        <TextField label="Утас" name="phone" type="tel" placeholder="9911 2233" basis="150px" />
      </InviteForm>
      <div className="table-wrap">
        <table className="table min-w-[820px]">
          <thead>
            <tr>
              <th>Админ</th>
              <th>И-мэйл</th>
              <th>Баталсан зар</th>
              <th>Зарагдсан</th>
              <th>Төлөв</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const c = counts.get(m.id) ?? newCounts();
              const self = m.id === me.id;
              return (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink text-[13px] font-bold text-yellow">
                        {initial(m.full_name ?? m.email)}
                      </span>
                      <span className="font-semibold">
                        {m.full_name ?? "—"}
                        {self ? " (та)" : ""}
                      </span>
                    </div>
                  </td>
                  <td className="text-body">{m.email}</td>
                  <td className="mono">{c.approved}</td>
                  <td className="mono">{c.sold}</td>
                  <td>
                    <AccountStatus blocked={m.is_blocked} />
                  </td>
                  <td>
                    {!self && (
                      <div className="flex gap-1.5">
                        <BlockButton id={m.id} blocked={m.is_blocked} back={back} />
                        <ActionButton action={removeStaff} fields={{ id: m.id }} back={back} className="btn-ghost">
                          Эрх хасах
                        </ActionButton>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {invites.map((i) => (
              <tr key={i.email}>
                <td className="font-semibold">{i.full_name ?? "—"}</td>
                <td className="text-body">{i.email}</td>
                <td className="mono">—</td>
                <td className="mono">—</td>
                <td>
                  <PendingInvite />
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
        Хаагдсан аккаунт панел руу нэвтэрч чадахгүй. Шинэ админ өөрийн Google и-мэйлээр нэвтэрмэгц эрх нь автоматаар
        идэвхжинэ.
      </span>
    </>
  );
}
