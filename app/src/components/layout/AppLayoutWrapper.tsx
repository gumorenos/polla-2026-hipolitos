'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';
import { authClient } from '../../lib/auth-client';

interface AppLayoutWrapperProps {
  children: React.ReactNode;
}

export const AppLayoutWrapper: React.FC<AppLayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  // Exclude login and API endpoints from the persistent shell
  const isAuthPage = pathname === '/login' || pathname.startsWith('/api/');

  if (isAuthPage) {
    return <>{children}</>;
  }

  // If the user status is blocked (rejected or disabled), do not wrap in AppShell
  // so they only see the full-screen block page.
  const isBlocked = session?.user?.status === 'rejected' || session?.user?.status === 'disabled';
  if (isBlocked) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
};
