import { ImageResponse } from "next/og";

import { getSetting } from "@/lib/dal";

// Branded link-preview card for the public marketing pages (/, /privacy, /terms).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Set: the home of the PAU Alumni Association";

export default async function Image() {
  const orgName =
    (await getSetting("org_name")) ?? "Pan-Atlantic University Alumni Association";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0A",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#3464C4",
            fontSize: "28px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{ width: 14, height: 14, borderRadius: 9999, background: "#3464C4" }}
          />
          Members only
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "150px",
              fontWeight: 700,
              fontStyle: "italic",
              color: "#FAFAFA",
              lineHeight: 1,
            }}
          >
            Set.
          </div>
          <div style={{ fontSize: "46px", color: "#E5E5E5", maxWidth: "900px" }}>
            The home of the PAU Alumni Association.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: "26px", color: "#737373" }}>
          {orgName}
        </div>
      </div>
    ),
    { ...size },
  );
}
