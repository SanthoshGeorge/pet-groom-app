import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Tails Grooming",
  description: "Book dog grooming appointments online — no account required.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Google Fonts (Lora/Karla) — matches the approved mockup canvas's own <link> tags
          (Main.dc.html and the booking-flow artboards all load these two families). A plain
          <link>, not next/font, so this never requires network access during
          `npx next build`/`npx vitest run` — only in the visitor's browser at runtime.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this rule targets the
            Pages Router's per-page <Head>; the App Router's root layout (this file) is the
            documented, correct place for a site-wide font <link>, not a per-page one. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Karla:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
