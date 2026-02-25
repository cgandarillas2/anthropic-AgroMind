import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgroMind - ERP Agrícola Inteligente",
  description:
    "Gestión de cerezos con IA integrada. Monitoreo climático, alertas de riesgo y optimización de cosecha para la Región del Maule.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className={`${inter.className} antialiased bg-background`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
