import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MainShell from "@/components/MainShell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "PinjamIn",
  description: "Sewa alat lab, buku, hingga kamera dari sesama mahasiswa sekitarmu!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="antialiased"><MainShell>{children}</MainShell></body>
    </html>
  );
}
