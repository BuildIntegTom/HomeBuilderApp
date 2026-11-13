import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./auth/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * ⚠ The icons and the link card are NOT declared here. Next's file conventions
 * pick them up from this same folder — `icon.png`, `apple-icon.png`,
 * `favicon.ico`, `opengraph-image.png` and `twitter-image.png` — and emit the
 * tags with the right sizes and types. An `icons` block here would be a
 * second, hand-maintained copy of that.
 *
 * All five are drawn from one master by
 * `apps/web/brand/generate-brand-assets.mjs`. Change the mark, re-run the
 * script, commit what it writes; never hand-edit the outputs.
 *
 * ⚠ `metadataBase` is what makes `og:image` absolute. Without it Next emits a
 * relative URL and **every unfurl silently loses the card** — iMessage, Slack,
 * WhatsApp and Discord all fetch the image from their own servers, which have
 * no idea what it is relative to.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://strawpanels.com"),
  title: "Building Integrity — Fabricator App",
  // ⚠ DRAFT WORDING, mine and not Tommy's. This is the line a client reads
  // under the card before deciding to click, so it replaced the old
  // note-to-ourselves ("Reference-only floor-plan layout editor for prefab
  // straw-panel homes."). One line to change if he wants it said differently.
  description: "Draw a straw-panel building, panel by panel, and get its shop drawings and its price.",
  openGraph: {
    type: "website",
    siteName: "Building Integrity",
    url: "https://strawpanels.com",
    title: "Building Integrity — Fabricator App",
    description: "Draw a straw-panel building, panel by panel, and get its shop drawings and its price.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Building Integrity — Fabricator App",
    description: "Draw a straw-panel building, panel by panel, and get its shop drawings and its price.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/*
          The auth provider sits ABOVE the editor, not inside it, and that is
          load-bearing rather than tidy: `children` is a stable element handed
          down from this Server Component, so the provider re-rendering when
          someone signs in does not re-render page.tsx at all. Only the
          components that call useAuth() see the change.

          The spec note this protects: "Signing in must not discard unsaved
          guest work ... a sign-in that navigates or remounts the editor loses
          the design." Mounting the provider inside the editor, or making
          sign-in a navigation instead of a fetch, would each break it.
        */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
