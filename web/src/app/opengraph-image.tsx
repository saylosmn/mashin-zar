import { ImageResponse } from "next/og";

export const alt = "Машин зар — менежерээр шалгагдсан автомашины зарууд";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Нүүр хуудсыг хуваалцахад гарах зураг (Facebook, Messenger, Telegram) */
export default async function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#111317", color: "#f3f4f1", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#f5b800", color: "#111317", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800 }}>М</div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>Машин зар</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 980 }}>Машинаа зар. Дараагийнхаа машиныг ол.</div>
          <div style={{ fontSize: 34, color: "#b7bcc4" }}>Менежерээр шалгагдсан зарууд · лизингийн тооцоолуур · шинэ зарын мэдэгдэл</div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ background: "#f5b800", color: "#111317", fontSize: 30, fontWeight: 700, padding: "10px 22px", borderRadius: 10 }}>2016+</div>
          <div style={{ border: "2px solid #2e333a", color: "#c9cdd3", fontSize: 30, padding: "8px 20px", borderRadius: 10 }}>2016-аас өмнө</div>
        </div>
      </div>
    ),
    size,
  );
}
