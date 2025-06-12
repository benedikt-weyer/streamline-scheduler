import { EnvVarWarning } from "@/components/auth/env-var-warning";
import HeaderAuth from "@/components/auth/header-auth";
import { ThemeSwitcher } from "@/components/dashboard/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { MobileNavbar } from "@/components/ui/mobile-navbar";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Streamline Sheduler",
  description: "Open source self hostable secure calendar todolist combo",
};

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
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <MobileNavbar 
              themeSwitcher={<ThemeSwitcher />}
              authComponent={!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
            />
            <main className="flex flex-col gap-20 w-full items-center">
              {children}
            </main>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
