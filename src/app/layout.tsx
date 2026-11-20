import type { Metadata, Viewport } from "next";
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
  title: "Copa Hostería - 4° Edición (28.11.2026)",
  description:
    "Torneo Copa Hostería 4° Edición: sorteo estilo FIFA con bombos, planilla en vivo, tabla de posiciones y estadísticas.",
};

export const viewport: Viewport = {
  themeColor: "#0F2557",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full font-sans text-white selection:bg-[#D49B35]/30">
        {children}
      </body>
    </html>
  );
}
