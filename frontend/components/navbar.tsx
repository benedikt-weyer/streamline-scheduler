'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/ui/navigation';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Image from 'next/image'

interface MobileNavbarProps {
  themeSwitcher: React.ReactNode;
  authComponent: React.ReactNode;
}

export function Navbar({ themeSwitcher, authComponent }: MobileNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className="w-full">
      {/* Desktop and Mobile Header */}
      <div className="flex justify-between items-center h-16 px-4 md:px-6 lg:px-10 border-b border-b-foreground/10">
        {/* Left side - Brand */}
        <div className="flex items-center gap-4">
          <Image src="/icon.png" alt="Streamline Scheduler" width={25} height={25} />
          <Link href="/" className="font-bold text-xl md:text-2xl">
            Streamline Scheduler
          </Link>
        </div>

        {/* Desktop Navigation - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-4">
          <NavLink href="/dashboard/can-do-list">Can-Do List</NavLink>
          <NavLink href="/dashboard/calendar">Calendar</NavLink>
          <NavLink href="/dashboard/scheduler">Scheduler</NavLink>
          <NavLink href="/dashboard/settings">Settings</NavLink>
        </div>

        {/* Right side - Theme switcher and Auth */}
        <div className="flex items-center gap-2 md:gap-4">
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
        <div className="md:hidden border-t border-t-foreground/10 bg-background">
          <div className="flex flex-col space-y-2 p-4">
            <div onClick={closeMenu}>
              <NavLink href="/dashboard/can-do-list" className="w-full justify-start">
                Can-Do List
              </NavLink>
            </div>
            <div onClick={closeMenu}>
              <NavLink href="/dashboard/calendar" className="w-full justify-start">
                Calendar
              </NavLink>
            </div>
            <div onClick={closeMenu}>
              <NavLink href="/dashboard/scheduler" className="w-full justify-start">
                Scheduler
              </NavLink>
            </div>
            <div onClick={closeMenu}>
              <NavLink href="/dashboard/settings" className="w-full justify-start">
                Settings
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 