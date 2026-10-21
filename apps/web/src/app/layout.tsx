import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import { localeFromHeader } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-sinhala",
  subsets: ["sinhala"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-tamil",
  subsets: ["tamil"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const headerStore = await headers();
  const locale = localeFromHeader(headerStore.get("x-infraos-public-locale"));
  const copy = getPublicCopy(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${notoSinhala.variable} ${notoTamil.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[var(--z-skip-link)] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-text-primary focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        >
          {copy.skipToMain}
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
