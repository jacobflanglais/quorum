import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

/**
 * iOS home-screen icon (apple-touch-icon).
 * Same design as the main icon but sized for iOS — required for
 * "Add to Home Screen" and iOS Web Push.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0b0e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: "serif",
            fontSize: 130,
            color: "#c8923c",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            display: "flex",
            marginTop: -8,
          }}
        >
          Q
        </span>
      </div>
    ),
    size,
  )
}
