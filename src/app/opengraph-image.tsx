import { ImageResponse } from "next/og";

export const alt = "PocketGizmo: precision 3D-printed accessories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social share image for pages without their own. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 80, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "#0b0b0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.25" strokeLinejoin="round">
              <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
              <path d="M4 7.5 12 12l8-4.5M12 12v9" />
            </svg>
          </div>
          <span style={{ fontSize: 40, fontWeight: 600, color: "#0b0b0f" }}>PocketGizmo</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 76, fontWeight: 600, color: "#0b0b0f", letterSpacing: -2, lineHeight: 1.05 }}>
            Precision-printed accessories for everyday carry.
          </span>
          <span style={{ marginTop: 24, fontSize: 30, color: "#5d6068" }}>Made to order in Bangladesh · bKash · Nagad · Rocket · COD</span>
        </div>
        <div style={{ height: 8, width: 160, background: "#2f5bff", borderRadius: 4 }} />
      </div>
    ),
    size,
  );
}
