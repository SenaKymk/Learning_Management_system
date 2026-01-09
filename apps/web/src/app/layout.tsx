import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import "../styles/globals.css";
import HeaderNav from "../components/HeaderNav";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "LMS Web",
  description: "Learning management system"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
      <body>
        <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-rose-950/40 to-slate-950">
          <div className="pointer-events-none absolute -top-40 left-1/3 h-80 w-80 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-primary-700/15 blur-3xl" />
          <header className="sticky top-0 z-10 border-b border-primary-500/30 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="text-lg font-semibold tracking-tight text-primary-100">
                LMS
              </Link>
              <HeaderNav />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
