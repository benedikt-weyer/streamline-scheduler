'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/ui/navigation';
import Link from 'next/link';
import { Menu, X, Settings } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shadcn-utils';
import { useSchedulerNav } from '@/contexts/scheduler-nav-context';

interface MobileNavbarProps {
  themeSwitcher: React.ReactNode;
  authComponent: React.ReactNode;
}

export function Navbar({ themeSwitcher, authComponent }: MobileNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isSettingsPage = pathname === '/settings';
  const isSchedulerPage = pathname === '/';
  const { schedulerNavContent } = useSchedulerNav();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className="w-full">
      {/* Desktop and Mobile Header */}
      <div className="flex items-center h-16 px-4 md:px-6 lg:px-10 border-b border-b-foreground/10">
        {/* Left side - Brand (links to scheduler) */}
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <Image src="/icon.png" alt="Streamline Scheduler" width={25} height={25} />
          <span className="font-bold text-xl md:text-2xl">
            Streamline Scheduler
          </span>
        </Link>

        {/* Center - Scheduler Navigation (only on scheduler page) */}
        {isSchedulerPage && schedulerNavContent && (
          <div className="flex-1 flex items-center justify-center">
            {schedulerNavContent}
          </div>
        )}

        {/* Right side - Settings, Theme switcher and Auth */}
        <div className={cn(
          "flex items-center gap-2 md:gap-4",
          !isSchedulerPage && "ml-auto"
        )}>
          {/* Settings icon - Hidden on mobile */}
          <Link href="/settings" className="hidden md:flex">
            <Button 
              variant="ghost" 
              size="icon" 
              aria-label="Settings"
              className={cn(isSettingsPage && "bg-secondary")}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          
          {themeSwitcher}
          {authComponent}
          
          {/* Mobile menu button - Only visible on mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Menu - Only visible when open */}
      {isOpen && (
        <div className="md:hidden border-t border-t-foreground/10 bg-background relative z-50">
          <div className="flex flex-col space-y-2 p-4">
            <div onClick={closeMenu}>
              <NavLink href="/settings" className="w-full justify-start">
                Settings
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 