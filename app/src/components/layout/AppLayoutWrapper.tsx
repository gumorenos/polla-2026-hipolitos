'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';
import { authClient } from '../../lib/auth-client';
import type { ViewMode } from '../../lib/view-mode';
import { ViewModeProvider } from './ViewModeProvider';

interface AppLayoutWrapperProps {
  children: React.ReactNode;
  storedViewMode: ViewMode | null;
}

export const AppLayoutWrapper: React.FC<AppLayoutWrapperProps> = ({ children, storedViewMode }) => {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const isSuperadmin = session?.user?.isSuperadmin === true;

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

  return (
    <ViewModeProvider isSuperadmin={isSuperadmin} storedViewMode={storedViewMode}>
      <AppShell>{children}</AppShell>
    </ViewModeProvider>
  );
};
