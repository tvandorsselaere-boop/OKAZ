import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OKAZ - La bonne affaire en 8 secondes",
  description:
    "Comparez LeBonCoin, Vinted, Back Market, Amazon et eBay en une seule recherche. Notre IA analyse chaque annonce et trouve les meilleures affaires.",
  keywords: [
    "okaz",
    "comparateur petites annonces",
    "leboncoin",
    "vinted",
    "back market",
    "amazon",
    "ebay",
    "occasion",
    "bonne affaire",
    "comparateur occasion",
  ],
  applicationName: "OKAZ",
  authors: [{ name: "Facile-IA", url: "https://facile-ia.fr" }],
  creator: "Facile-IA",
  metadataBase: new URL("https://okaz-ia.fr"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "OKAZ - La bonne affaire en 8 secondes",
    description:
      "Comparez LeBonCoin, Vinted, Back Market, Amazon et eBay en une recherche. L'IA analyse chaque annonce.",
    type: "website",
    url: "https://okaz-ia.fr",
    siteName: "OKAZ",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "OKAZ - La bonne affaire en 8 secondes",
    description:
      "Comparez 5 sites d'occasion en une recherche. L'IA trouve la meilleure affaire.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Theme detection - prevents flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "OKAZ",
              "url": "https://okaz-ia.fr",
              "description": "Comparez LeBonCoin, Vinted, Back Market, Amazon et eBay en une seule recherche. Notre IA analyse chaque annonce et trouve les meilleures affaires.",
              "applicationCategory": "ShoppingApplication",
              "operatingSystem": "Chrome",
              "browserRequirements": "Requires Google Chrome with OKAZ extension",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "EUR",
                "description": "5 recherches gratuites par jour"
              },
              "author": {
                "@type": "Organization",
                "name": "Facile-IA",
                "url": "https://facile-ia.fr"
              },
              "inLanguage": "fr"
            }),
          }}
        />
        {/* AdSense - Chargé uniquement si configuré */}
        {adsenseClient && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
