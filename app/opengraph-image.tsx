import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Quorum — a council of frontier models"

/**
 * OpenGraph preview image for link sharing (Slack, Twitter, iMessage, etc.).
 * Editorial dark composition matching the in-app aesthetic.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0b0e",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          position: "relative",
        }}
      >
        {/* eyebrow rule + tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#a8a8a0",
            fontFamily: "monospace",
            fontSize: 18,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 60,
              height: 1,
              background: "#7a5b26",
            }}
          />
          A council of frontier models
        </div>

        {/* headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontFamily: "serif",
            color: "#f5f5f0",
            fontSize: 124,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          <span>Ask once.</span>
          <span style={{ color: "#c8923c" }}>Hear all three.</span>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#6e6e68",
            fontFamily: "monospace",
            fontSize: 18,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "#f5f5f0", fontFamily: "serif", fontSize: 48, letterSpacing: "-0.02em", textTransform: "none" }}>
            Quorum
          </span>
          <span>Claude · GPT · Gemini</span>
        </div>
      </div>
    ),
    size,
  )
}
