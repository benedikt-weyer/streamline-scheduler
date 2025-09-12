'use client';

import HeaderAuth from "@/components/auth/header-auth";
import { ThemeSwitcher } from "@/components/dashboard/theme-switcher";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";

// Initialize backend connection
import "@/utils/api/init";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <head>
        <title>Streamline Scheduler</title>
        <meta name="description" content="Open source self hostable secure calendar todolist combo" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/icon.png" />
      </head>
      <body className="bg-background text-foreground min-h-screen flex flex-col items-center">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
            <Navbar 
              themeSwitcher={<ThemeSwitcher />}
              authComponent={<HeaderAuth />}
            />
            <main className="flex flex-col gap-20 w-full items-center">
              {children}
            </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
