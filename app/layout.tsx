import type { Metadata, Viewport } from "next"
import { Inter, Fraunces, Geist_Mono } from "next/font/google"
import "./globals.css"
import { PWARegister } from "@/components/PWARegister"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

// Vercel auto-injects VERCEL_PROJECT_PRODUCTION_URL for the canonical
// production URL. Falls back to the current deployment URL in previews,
// and localhost in dev. Used to resolve OG and Twitter image URLs.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Quorum",
    template: "%s · Quorum",
  },
  description:
    "A council of frontier models. Ask once, get a synthesized answer from Claude, GPT, and Gemini.",
  applicationName: "Quorum",
  appleWebApp: {
    capable: true,
    title: "Quorum",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    title: "Quorum",
    description:
      "A council of frontier models. Ask once, hear all three.",
    siteName: "Quorum",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quorum",
    description:
      "A council of frontier models. Ask once, hear all three.",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // PWA-friendly: allow safe-area insets on iOS notch/Dynamic Island
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  )
}
