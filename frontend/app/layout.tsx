import type { Metadata } from "next";
import { Cinzel, Inter, JetBrains_Mono, Cinzel_Decorative } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const cinzelDecorative = Cinzel_Decorative({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-decorative",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Revenant — Cognitive State Engine",
  description:
    "The first NPC engine where rumors are graph edges, trust is bi-temporal, and forgetting costs 50 gold. Powered by Cognee Cloud knowledge graph.",
  keywords: ["NPC", "AI", "Cognee", "knowledge graph", "RPG", "memory"],
  openGraph: {
    title: "Revenant — Cognitive State Engine",
    description: "NPCs have been amnesiac since 1980. Revenant fixes that.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${cinzelDecorative.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body className="bg-base text-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
