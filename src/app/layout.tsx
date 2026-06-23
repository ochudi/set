import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";

import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Set: the home of the PAU Alumni Association",
    template: "%s / Set",
  },
  description:
    "Set is the members-only home of the Pan-Atlantic University Alumni Association: a private directory, events, and fundraisers for alumni.",
  applicationName: "Set",
  openGraph: {
    type: "website",
    siteName: "Set",
    locale: "en_NG",
    title: "Set: the home of the PAU Alumni Association",
    description:
      "The members-only home of the Pan-Atlantic University Alumni Association.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Set: the home of the PAU Alumni Association",
    description:
      "The members-only home of the Pan-Atlantic University Alumni Association.",
  },
  // Sitewide noindex/nofollow for now. Marketing, privacy, terms, and public
  // campaign pages will opt back in by overriding `robots` in their own metadata.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
