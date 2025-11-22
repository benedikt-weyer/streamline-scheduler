'use client';

import HeaderAuth from "@/components/auth/header-auth";
import { ThemeSwitcher } from "@/components/dashboard/theme-switcher";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { SchedulerNavProvider } from "@/contexts/scheduler-nav-context";
import { UserSettingsProvider } from "@/utils/context/UserSettingsContext";
import { LanguageProvider } from "@/utils/context/LanguageContext";

// Initialize backend connection
import "@/utils/api/init";

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
          <LanguageProvider>
            <UserSettingsProvider>
          <SchedulerNavProvider>
            <Navbar 
              themeSwitcher={<ThemeSwitcher />}
              authComponent={<HeaderAuth />}
            />
            <main className="flex flex-col gap-20 w-full items-center">
              {children}
            </main>
          </SchedulerNavProvider>
          <Toaster />
            </UserSettingsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
