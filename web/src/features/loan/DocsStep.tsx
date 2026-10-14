"use client";

import { packDocs } from "@shared/loan-form";
import { createClient } from "@/lib/supabase/client";
import { errMsg } from "@/lib/format";
import { LOAN_DOCS, MAX_DOC_PAGES, docBase, docHint, docPage, docPageKeys, type Partner } from "@/lib/loan";
import { IconSpinner } from "@/components/icons";
import { Heading, Notice } from "./controls";

export type LoanDoc = { path: string; name: string; reused?: boolean };
type Docs = Record<string, LoanDoc>;

const MAX_PDF = 10 * 1024 * 1024;

/** Том зургийг 2000px хүртэл багасгаж JPEG болгоно */
async function compress(file: File, max = 2000): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

const quietRemove = (path: string) => {
  createClient()
    .storage.from("loan-docs")
    .remove([path])
    .then(() => {});
};

export function DocsStep({
  userId,
  batch,
  partner,
  docs,
  setDocs,
  required,
  hasCosigner,
  onError,
  uploading,
  setUploading,
}: {
  userId: string;
  batch: string;
  partner: Partner;
  docs: Docs;
  setDocs: (fn: (d: Docs) => Docs) => void;
  required: string[];
  hasCosigner: boolean;
  onError: (e: string | null) => void;
  uploading: string | null;
  setUploading: (key: string | null) => void;
}) {
  async function upload(key: string, file: File | undefined) {
    if (!file) return;
    onError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf && !file.type.startsWith("image/")) return onError("Зөвхөн зураг эсвэл PDF файл хавсаргана");
    if (isPdf && file.size > MAX_PDF) return onError("PDF файл 10MB-аас ихгүй байна");
    setUploading(key);
    try {
      const body = isPdf ? file : await compress(file);
      const path = `${userId}/${batch}/${key}-${Date.now()}.${isPdf ? "pdf" : "jpg"}`;
      const { error } = await createClient()
        .storage.from("loan-docs")
        .upload(path, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
      if (error) throw error;
      const old = docs[key];
      setDocs((d) => ({ ...d, [key]: { path, name: file.name } }));
      // Өмнөх хүсэлтийн файлыг тэр хүсэлт ашигласаар байгаа тул устгахгүй
      if (old && !old.reused) quietRemove(old.path);
    } catch (e) {
      onError(`Хавсаргаж чадсангүй: ${errMsg(e)}`);
    } finally {
      setUploading(null);
    }
  }

  function remove(key: string) {
    const old = docs[key];
    setDocs((d) => {
      const next = { ...d };
      delete next[key];
      return packDocs(next);
    });
    if (old && !old.reused) quietRemove(old.path);
  }

  const kinds = LOAN_DOCS.filter((x) => x.kind !== "cosigner_id" || hasCosigner);

  return (
    <>
      <Heading>Баримт бичиг</Heading>
      {Object.values(docs).some((d) => d.reused) && (
        <Notice tone="ok">
          Өмнөх хүсэлтэд хавсаргасан баримтуудыг автоматаар нэмлээ. Хуучирсан бол хасаад шинээр хавсаргана уу.
        </Notice>
      )}
      <p className="m-0 text-[13px] text-muted">
        Олон хуудастай баримтыг (дансны хуулга гэх мэт) «+ Хуудас нэмэх»-ээр {MAX_DOC_PAGES} хүртэл хуудсаар оруулна.
        Зураг эсвэл PDF. Лавлагаануудыг{" "}
        <a href="https://e-mongolia.mn" target="_blank" rel="noreferrer">
          e-mongolia.mn
        </a>
        -ээс үнэгүй татна. Файлууд зөвхөн {partner.name}-д харагдана.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {kinds.map((x) => {
          const pages = docPageKeys(x.kind).filter((k) => docs[k]);
          return (
            <DocItem
              key={x.kind}
              label={x.label}
              hint={docHint(x)}
              required={required.includes(x.kind)}
              pages={pages.map((k) => ({ key: k, page: docPage(k).page, name: docs[k].name }))}
              nextKey={docPageKeys(x.kind).find((k) => !docs[k])}
              busy={!!uploading && docBase(uploading) === x.kind}
              disabled={!!uploading}
              onUpload={upload}
              onRemove={remove}
            />
          );
        })}
      </ul>
    </>
  );
}

function DocItem({
  label,
  hint,
  required,
  pages,
  nextKey,
  busy,
  disabled,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string | null;
  required: boolean;
  pages: { key: string; page: number; name: string }[];
  nextKey: string | undefined;
  busy: boolean;
  disabled: boolean;
  onUpload: (key: string, file: File | undefined) => void;
  onRemove: (key: string) => void;
}) {
  const have = pages.length > 0;
  const fileButton = (key: string, text: string, primary: boolean) => (
    <label className={`btn btn-sm ${primary ? "btn-ink" : "btn-ghost"} cursor-pointer`}>
      {text}
      <input
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onUpload(key, e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${have ? "border-[#9BD3AE] bg-[#F1FAF4]" : "border-line"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          <span className="text-[14px] font-semibold">
            {label}{" "}
            {required ? (
              <span className="badge ml-1 bg-pending-bg text-pending-fg">заавал</span>
            ) : (
              <span className="text-[12px] font-normal text-muted">· заавал биш</span>
            )}
          </span>
          {!have && hint && <span className="text-[12px] text-muted">{hint}</span>}
        </div>
        {busy ? (
          <span className="btn btn-sm btn-ghost">
            <IconSpinner size={16} /> Хуулж байна
          </span>
        ) : !have ? (
          nextKey && fileButton(nextKey, "Хавсаргах", true)
        ) : (
          nextKey && fileButton(nextKey, "+ Хуудас нэмэх", false)
        )}
      </div>
      {have && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {pages.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate text-[#1D6B3A]">
                ✓ {p.page}-р хуудас · {p.name}
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.key)}
                disabled={disabled}
                className="cursor-pointer border-0 bg-transparent text-[12px] text-[#9b1c1c] underline"
              >
                Хасах
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
