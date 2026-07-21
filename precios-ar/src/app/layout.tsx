import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | PreciosAR",
    default: "PreciosAR — Comparador de precios en Argentina",
  },
  description:
    "Compará precios de supermercados, pinturerías, corralones y más en toda Argentina. Encontrá el precio más barato cerca tuyo.",
  openGraph: {
    title: "PreciosAR — Comparador de precios en Argentina",
    description:
      "Compará precios de supermercados, pinturerías, corralones y más en toda Argentina. Encontrá el precio más barato cerca tuyo.",
    type: "website",
    siteName: "PreciosAR",
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
