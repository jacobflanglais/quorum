import { ImageResponse } from "next/og"

export const size = { width: 512, height: 512 }
export const contentType = "image/png"

/**
 * Quorum app icon: bronze "Q" on charcoal.
 * Used for PWA install (home screen), browser favicon, and manifest.
 */
export default function Icon() {
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
        {/* subtle border ring for definition on light surfaces */}
        <div
          style={{
            position: "absolute",
            inset: 12,
            border: "2px solid #26262e",
            borderRadius: 96,
          }}
        />
        <span
          style={{
            fontFamily: "serif",
            fontSize: 340,
            color: "#c8923c",
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            display: "flex",
            // optical centering — Q hangs slightly low so nudge up
            marginTop: -24,
          }}
        >
          Q
        </span>
      </div>
    ),
    size,
  )
}
