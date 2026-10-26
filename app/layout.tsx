import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource/overpass/latin-600.css";
import "@fontsource/overpass/latin-700.css";
import "@fontsource/overpass/latin-800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Delivery Portal · TSS",
  description: "Dispatch, live fleet tracking and proof of delivery for Traffic Safety Service.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1f2429",
};

// Restores the collapsed sidebar before first paint so it never jumps.
const RAIL_SCRIPT = `try{if(localStorage.getItem("tss-rail")==="collapsed")document.documentElement.dataset.rail="collapsed"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RAIL_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
