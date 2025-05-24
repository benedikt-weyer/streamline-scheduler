import { EnvVarWarning } from "@/components/auth/env-var-warning";
import HeaderAuth from "@/components/auth/header-auth";
import { ThemeSwitcher } from "@/components/dashboard/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";

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

              <nav className="w-full flex justify-between items-center border-b border-b-foreground/10 h-20 px-10">
                  <div className="flex items-center gap-4">
                    <Link href={"/"} className="font-bold text-2xl">Streamline Sheduler</Link>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/can-do-list">Can-Do List</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/calendar">Calendar</Link>
                    </Button>
                  </div>

                  {/* Right section of the navigation bar */}
                  <div className="flex items-center gap-4">
                    <ThemeSwitcher />
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                  </div>
              </nav>

              <main className="flex flex-col gap-20 w-full px-5">
                {children}
              </main>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
