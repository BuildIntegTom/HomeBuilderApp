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

export const metadata: Metadata = {
  title: "Building Integrity — Fabricator App",
  description: "Reference-only floor-plan layout editor for prefab straw-panel homes.",
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
