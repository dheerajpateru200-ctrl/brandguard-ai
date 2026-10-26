import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";

const ui = Public_Sans({ subsets: ["latin"], variable: "--font-ui" });
const doc = Newsreader({ subsets: ["latin"], variable: "--font-doc" });

export const metadata: Metadata = {
  title: "BrandGuard AI",
  description: "Check marketing content against your brand rules before it goes live.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={ui.variable + " " + doc.variable}>
      <body>{children}</body>
    </html>
  );
}
