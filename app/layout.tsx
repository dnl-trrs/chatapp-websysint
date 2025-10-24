import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import BetaBanner from "@/components/BetaBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chat App - Next.js Discord Clone",
  description: "A modern chat application built with Next.js and Firebase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <ToastProvider>
            <BetaBanner />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
