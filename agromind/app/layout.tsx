import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgroMind - Smart Agricultural ERP",
  description:
    "Cherry orchard management with integrated AI. Climate monitoring, risk alerts and harvest optimization for the Maule Region.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} antialiased bg-background`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
