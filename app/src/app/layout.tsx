import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { AppLayoutWrapper } from "../components/layout/AppLayoutWrapper";
import { cookies } from "next/headers";
import { parseViewMode, VIEW_MODE_COOKIE_NAME } from "../lib/view-mode";
import {
  getLegacyThemeClass,
  parseThemePreferences,
  THEME_PALETTE_COOKIE_NAME,
  THEME_SCHEME_COOKIE_NAME,
} from "../lib/theme-preferences";

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
  title: 'La Polla Hipólitos 2026',
  description: 'Predicciones, Champion Survivor y retos por partido para el Mundial 2026 entre amigos.',
  applicationName: 'La Polla Hipólitos 2026',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'La Polla Hipólitos 2026',
    description: 'Predicciones, supervivencia y retos por partido del Mundial 2026.',
    type: 'website',
    locale: 'es_PE',
    siteName: 'La Polla Hipólitos 2026',
  },
  twitter: {
    card: 'summary',
    title: 'La Polla Hipólitos 2026',
    description: 'Predicciones, Champion Survivor y retos por partido para el Mundial 2026.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'La Polla 2026',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themePreferences = parseThemePreferences(
    cookieStore.get(THEME_SCHEME_COOKIE_NAME)?.value,
    cookieStore.get(THEME_PALETTE_COOKIE_NAME)?.value,
    cookieStore.get('themeMode')?.value,
  );
  const storedViewMode = parseViewMode(cookieStore.get(VIEW_MODE_COOKIE_NAME)?.value);

  return (
    <html
      lang="es"
      data-theme-scheme={themePreferences.scheme}
      data-theme-palette={themePreferences.palette}
      className={`${dmSans.variable} ${ibmPlexMono.variable} ${bebasNeue.variable} h-full antialiased ${getLegacyThemeClass(themePreferences.scheme)}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AppLayoutWrapper storedViewMode={storedViewMode}>{children}</AppLayoutWrapper>
      </body>
    </html>
  );
}
