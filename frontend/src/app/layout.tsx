import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MainLayout } from "@/components/layout/MainLayout";
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rigeru",
  description: "Unified Media Workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-white overflow-hidden`}
      >
        <Toaster position="bottom-right" toastOptions={{
          className: '!bg-zinc-900 !text-white !border !border-white/10',
          style: {
            background: 'var(--theme-ui-bg)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-ui-border)',
          },
        }} />
        <MainLayout>
           {children}
        </MainLayout>
      </body>
    </html>
  );
}
