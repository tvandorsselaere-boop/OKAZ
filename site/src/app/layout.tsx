import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OKAZ - La bonne affaire en 8 secondes",
  description:
    "Comparez LeBonCoin, Vinted et Back Market en une seule recherche. Notre IA detecte les arnaques et trouve les pepites.",
  keywords: [
    "okaz",
    "comparateur petites annonces",
    "leboncoin",
    "vinted",
    "back market",
    "occasion",
    "bonne affaire",
  ],
  openGraph: {
    title: "OKAZ - La bonne affaire en 8 secondes",
    description:
      "Comparez LeBonCoin, Vinted et Back Market. Notre IA detecte les arnaques.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
