import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { AppLayoutWrapper } from "../components/layout/AppLayoutWrapper";
import { cookies } from "next/headers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: ["400"],
});

import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#d4af37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "La Polla 2026 — World Cup Pool",
  description: "Private World Cup 2026 prediction pool application.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "La Polla 2026",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeMode = cookieStore.get('themeMode')?.value || 'black';

  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${ibmPlexMono.variable} ${bebasNeue.variable} h-full antialiased theme-${themeMode}`}
    >
      <body className="min-h-full flex flex-col">
        <AppLayoutWrapper>{children}</AppLayoutWrapper>
      </body>
    </html>
  );
}
