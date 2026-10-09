import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { CONTRACT_TITLE, contractDate, contractSections, ubParts, type ContractData } from "./contract";

const A4: [number, number] = [595.28, 841.89];
const M = 46; // захын зай
const INK = rgb(0.067, 0.075, 0.09);
const MUTED = rgb(0.36, 0.38, 0.42);

let fonts: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function loadFonts() {
  if (!fonts) {
    const dir = path.join(process.cwd(), "src", "fonts");
    const [regular, bold] = await Promise.all([readFile(path.join(dir, "Onest-Regular.ttf")), readFile(path.join(dir, "Onest-Bold.ttf"))]);
    fonts = { regular, bold };
  }
  return fonts;
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  const indent = text.match(/^\s*/)?.[0] ?? "";
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : `${indent}${word}`;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = `${indent}   ${word}`;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Гэрээний PDF. signatureSvg байхгүй бол хэвлэж гараар бөглөх хоосон загвар болно. */
export async function renderContractPdf(c: ContractData, signatureSvg?: string | null): Promise<Uint8Array> {
  const f = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(f.regular, { subset: true });
  const bold = await doc.embedFont(f.bold, { subset: true });
  doc.setTitle(`${CONTRACT_TITLE}${c.number ? ` №${c.number}` : ""}`);
  doc.setAuthor(c.company);
  doc.setCreator("Машин зар");

  const width = A4[0] - M * 2;
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;
  const ensure = (h: number) => {
    if (y - h < M) {
      page = doc.addPage(A4);
      y = A4[1] - M;
    }
  };
  const text = (s: string, font: PDFFont, size: number, opts: { color?: ReturnType<typeof rgb>; gap?: number; center?: boolean } = {}) => {
    for (const ln of wrap(s, font, size, width)) {
      ensure(size + 4);
      const x = opts.center ? M + (width - font.widthOfTextAtSize(ln, size)) / 2 : M;
      page.drawText(ln, { x, y: y - size, size, font, color: opts.color ?? INK });
      y -= size + (opts.gap ?? 4.5);
    }
  };

  // Гарчиг
  text(CONTRACT_TITLE, bold, 14.5, { center: true, gap: 7 });
  const meta = `№ ${c.number ?? "______"}  ·  Улаанбаатар хот  ·  ${contractDate(c.date)}`;
  text(meta, regular, 10, { center: true, color: MUTED });
  y -= 10;

  for (const s of contractSections(c)) {
    if (s.heading) {
      y -= 4;
      text(s.heading, bold, 11, { gap: 4.5 });
    }
    for (const l of s.lines) {
      text(l, regular, 9.8, { gap: 3.3 });
      y -= 1.2;
    }
  }

  // Гарын үсгийн хэсэг
  y -= 14;
  ensure(150);
  const colW = (width - 30) / 2;
  const top = y;
  const sigBlock = (x: number, title: string, lines: string[], svg?: string | null) => {
    let yy = top;
    page.drawText(title, { x, y: yy - 11, size: 11, font: bold, color: INK });
    yy -= 24;
    for (const l of lines) {
      for (const ln of wrap(l, regular, 10, colW)) {
        page.drawText(ln, { x, y: yy - 10, size: 10, font: regular, color: INK });
        yy -= 15;
      }
    }
    // гарын үсгийн талбай
    const boxH = 62;
    yy -= 6;
    if (svg) {
      const scale = colW / 600;
      page.drawSvgPath(svg, { x, y: yy, scale: Math.min(scale, boxH / 200), borderColor: rgb(0.05, 0.12, 0.45), borderWidth: 4 });
    }
    yy -= boxH;
    page.drawLine({ start: { x, y: yy }, end: { x: x + colW, y: yy }, thickness: 0.8, color: MUTED });
    page.drawText("Гарын үсэг", { x, y: yy - 12, size: 9, font: regular, color: MUTED });
    return yy - 16;
  };
  const yA = sigBlock(M, "ЭЗЭМШИГЧ", [`Овог нэр: ${c.fullName || "______________________"}`, `Утас: ${c.phone || "______________"}`], signatureSvg);
  const yB = sigBlock(M + colW + 30, "ЗУУЧЛАГЧ", [`«${c.company}»`, "Төлөөлж: ______________________"], null);
  y = Math.min(yA, yB) - 10;

  if (signatureSvg && c.date) {
    // тэмдэглэгээг доод захын зайд багтаана (шинэ хуудас нээхгүй)
    if (y - 26 < 18) {
      page = doc.addPage(A4);
      y = A4[1] - M;
    }
    const stamp = `Цахимаар гарын үсэг зурж зөвшөөрсөн: ${contractDate(c.date)}, ${ubParts(c.date).time} (Улаанбаатарын цагаар)${c.number ? ` · Гэрээний № ${c.number}` : ""}`;
    for (const ln of wrap(stamp, regular, 8.5, width)) {
      page.drawText(ln, { x: M, y: y - 8.5, size: 8.5, font: regular, color: MUTED });
      y -= 12;
    }
  }

  return doc.save();
}
