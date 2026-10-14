import { createClient } from "@/lib/supabase/server";
import { inviteDealer, removeDealer } from "@/actions/accounts";
import type { Profile } from "@shared/types";
import {
  AccountStatus,
  ActionButton,
  BlockButton,
  CancelInvite,
  EmptyRow,
  InviteForm,
  PendingInvite,
  TextField,
  idsOrNone,
  newCounts,
  type Counts,
  type Invite,
} from "./shared";

export async function DealersTab({ back, email }: { back: string; email?: string }) {
  const supabase = await createClient();
  const [{ data: dealers }, { data: inv }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "dealer").order("shop_name"),
    supabase.from("staff_invites").select("*").eq("role", "dealer").order("created_at", { ascending: false }),
  ]);
  const rows = (dealers ?? []) as Profile[];
  const emails = new Set(rows.map((r) => r.email?.toLowerCase()));
  const invites = ((inv ?? []) as Invite[]).filter((i) => !emails.has(i.email.toLowerCase()));
  const { data: ads } = await supabase
    .from("ads")
    .select("user_id,status")
    .in("user_id", idsOrNone(rows.map((r) => r.id)));
  const counts = new Map<string, Counts>();
  for (const a of ads ?? []) {
    const c = counts.get(a.user_id) ?? newCounts();
    if (a.status === "active") c.approved++;
    if (a.status === "sold") c.sold++;
    c.ads++;
    counts.set(a.user_id, c);
  }

  return (
    <>
      <InviteForm
        action={inviteDealer}
        back={back}
        title="Авто худалдаа нэмэх"
        note="Байнгын харилцагч. Зар нь шалгалтгүй, гэрээгүйгээр шууд нийтлэгдэж, өөрсдөө засаж, нууж, зарагдсан болгоно."
        submit="Нэмэх"
      >
        <TextField label="Авто худалдааны нэр" name="shop" required placeholder="Мега Авто" />
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
        <table className="table min-w-[820px]">
          <thead>
            <tr>
              <th>Авто худалдаа</th>
              <th>И-мэйл</th>
              <th>Утас</th>
              <th>Идэвхтэй зар</th>
              <th>Зарагдсан</th>
              <th>Төлөв</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && invites.length === 0 && (
              <EmptyRow cols={7} text="Одоогоор авто худалдаа бүртгэгдээгүй байна." />
            )}
            {rows.map((d) => {
              const c = counts.get(d.id) ?? newCounts();
              return (
                <tr key={d.id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-semibold">{d.shop_name ?? "—"}</span>
                      <span className="text-[12px] text-muted">{d.full_name ?? ""}</span>
                    </div>
                  </td>
                  <td className="text-body">{d.email}</td>
                  <td className="mono">{d.phone ?? "—"}</td>
                  <td className="mono">{c.approved}</td>
                  <td className="mono">{c.sold}</td>
                  <td>
                    <AccountStatus blocked={d.is_blocked} />
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <BlockButton id={d.id} blocked={d.is_blocked} back={back} />
                      <ActionButton action={removeDealer} fields={{ id: d.id }} back={back} className="btn-ghost">
                        Эрх хасах
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {invites.map((i) => (
              <tr key={i.email}>
                <td className="font-semibold">{i.shop_name ?? "—"}</td>
                <td className="text-body">{i.email}</td>
                <td className="mono">—</td>
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
        Бүртгэлтэй хэрэглэгч бол эрх шууд идэвхжинэ. Бүртгүүлээгүй бол тэр и-мэйлээр нэвтэрмэгц авто худалдааны эрхтэй
        болно.
      </span>
    </>
  );
}
