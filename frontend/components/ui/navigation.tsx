'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Button 
      asChild 
      variant={isActive ? "default" : "ghost"} 
      size="sm"
      className={isActive ? "bg-primary text-primary-foreground" : ""}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
} 