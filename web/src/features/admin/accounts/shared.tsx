import { deleteInvite, setBlocked } from "@/actions/accounts";

export type Invite = { email: string; role: string; full_name: string | null; shop_name?: string | null };
export type Counts = { approved: number; sold: number; ads: number };

/** IN (...) хоосон байж болохгүй тул байхгүй uuid нэмнэ */
export const idsOrNone = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

export const newCounts = (): Counts => ({ approved: 0, sold: 0, ads: 0 });

export function AccountStatus({ blocked }: { blocked: boolean }) {
  return blocked ? (
    <span className="badge bg-sold-bg text-sold-fg">Хаагдсан</span>
  ) : (
    <span className="badge bg-active-bg text-active-fg">Идэвхтэй</span>
  );
}

export function PendingInvite() {
  return <span className="badge bg-pending-bg text-pending-fg">Нэвтрэхийг хүлээж буй</span>;
}

/** Нэг товчтой form: id болон буцах хаягийг нууц талбараар дамжуулна */
export function ActionButton({
  action,
  fields,
  back,
  className,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  back: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="back" value={back} />
      <button className={`btn btn-sm ${className}`}>{children}</button>
    </form>
  );
}

export function BlockButton({ id, blocked, back }: { id: string; blocked: boolean; back: string }) {
  return (
    <ActionButton
      action={setBlocked}
      fields={{ id, blocked: blocked ? "0" : "1" }}
      back={back}
      className={blocked ? "btn-ghost" : "btn-danger"}
    >
      {blocked ? "Нээх" : "Хаах"}
    </ActionButton>
  );
}

export function CancelInvite({ email, back }: { email: string; back: string }) {
  return (
    <ActionButton action={deleteInvite} fields={{ email }} back={back} className="btn-danger">
      Цуцлах
    </ActionButton>
  );
}

/** Хар дэвсгэртэй "нэмэх" маягт */
export function InviteForm({
  action,
  back,
  title,
  note,
  submit,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  back: string;
  title: string;
  note: string;
  submit: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-2xl bg-ink p-5 text-paper">
      <input type="hidden" name="back" value={back} />
      <span className="h-display basis-full text-[16px]">{title}</span>
      <span className="-mt-1 basis-full text-[13px] text-pale">{note}</span>
      {children}
      <button className="btn btn-yellow h-11">{submit}</button>
    </form>
  );
}

export function TextField({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  basis = "200px",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  basis?: string;
}) {
  return (
    <label className="label text-paper" style={{ flex: `1 1 ${basis}` }}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="input h-11"
        placeholder={placeholder}
      />
    </label>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="text-muted">
        {text}
      </td>
    </tr>
  );
}
