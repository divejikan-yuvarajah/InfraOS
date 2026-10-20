import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { MAIN_CONTENT_ID, SKIP_TO_MAIN_LABEL } from "@/lib/accessibility/document-landmarks";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "INFRAOS",
    template: "%s · INFRAOS",
  },
  description:
    "National Infrastructure Intelligence & Coordination Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[var(--z-skip-link)] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text-primary focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        >
          {SKIP_TO_MAIN_LABEL}
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
