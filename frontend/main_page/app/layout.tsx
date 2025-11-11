import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { defaultLocale } from "../i18n-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeepBrain Tech",
  description: "DeepBrain Tech Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 根 layout：只是渲染 children，因为实际路由在 [locale] 下
  // 如果访问根路径，middleware 会重定向到 /zh 或 /en
  return (
    <html lang={defaultLocale}>
      <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
