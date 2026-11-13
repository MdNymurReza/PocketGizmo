import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "PocketGizmo: Little Gadgets. Big Smiles.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social share image for pages without their own. */
export default async function OgImage() {
  const logo = await readFile(join(process.cwd(), "public/logo-trimmed.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #ffffff 0%, #f5edff 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <span style={{ fontSize: 64, fontWeight: 600, color: "#0b0b0f", letterSpacing: -2, lineHeight: 1.05 }}>
            3D-printed accessories, made to order.
          </span>
          <span style={{ marginTop: 24, fontSize: 28, color: "#5d6068" }}>Delivered across Bangladesh · bKash · Nagad · Rocket · COD</span>
          <div style={{ marginTop: 36, height: 8, width: 160, background: "#7c3aed", borderRadius: 4 }} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={logoSrc} width={486} height={304} />
      </div>
    ),
    size,
  );
}
