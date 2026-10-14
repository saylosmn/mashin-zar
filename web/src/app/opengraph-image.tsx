import { ImageResponse } from "next/og";

export const alt = "Autoshop.mn — шалгагдсан автомашины зарууд";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Лого (app/icon.svg-тэй ижил) */
const MARK = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxMTEzMTciLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMiAzMikgc2NhbGUoMS4wKSB0cmFuc2xhdGUoLTMyIC0zMikiPjxwb2x5bGluZSBwb2ludHM9IjE0LDUwIDMyLDEzIDUwLDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNGNUI4MDAiIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTMyIDQxLjUgVjQ4LjUiIHN0cm9rZT0iI0YzRjRGMSIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48cGF0aCBkPSJNMzIgMzEuNSBWMzUuNSIgc3Ryb2tlPSIjRjNGNEYxIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxwYXRoIGQ9Ik0zMiAyNS4yIFYyNy4yIiBzdHJva2U9IiNGM0Y0RjEiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L2c+PC9zdmc+`;

/** Нүүр хуудсыг хуваалцахад гарах зураг (Facebook, Messenger, Telegram) */
export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#111317",
          color: "#f3f4f1",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={MARK} width={80} height={80} alt="" style={{ borderRadius: 20, border: "2px solid #2e333a" }} />
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>
            <span>Autoshop</span>
            <span style={{ color: "#f5b800", marginLeft: -9 }}>.mn</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 980 }}>
            Машинаа зар. Дараагийнхаа машиныг ол.
          </div>
          <div style={{ fontSize: 34, color: "#b7bcc4" }}>
            Шалгагдсан зарууд · лизингийн тооцоолуур · шинэ зарын мэдэгдэл
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div
            style={{
              background: "#f5b800",
              color: "#111317",
              fontSize: 30,
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: 10,
            }}
          >
            2016+
          </div>
          <div
            style={{
              border: "2px solid #2e333a",
              color: "#c9cdd3",
              fontSize: 30,
              padding: "8px 20px",
              borderRadius: 10,
            }}
          >
            2016-аас өмнө
          </div>
        </div>
      </div>
    ),
    size,
  );
}
