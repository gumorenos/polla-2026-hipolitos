'use client';

import React from 'react';
import Link from 'next/link';
import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';
import { LogIn, Shield } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ParticipantViewBanner } from './ParticipantViewBanner';
import { useViewMode } from './ViewModeProvider';

interface AppShellProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  isSessionPending: boolean;
}

function MobileHeader({
  isAuthenticated,
  isSessionPending,
}: Pick<AppShellProps, 'isAuthenticated' | 'isSessionPending'>) {
  const { showAdminUi } = useViewMode();

  return (
    <header className="md:hidden h-14 bg-bg-tertiary border-b border-border-default flex items-center justify-between px-4 sticky top-0 z-40 shadow-md">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400 font-bold font-display text-lg tracking-wider">
          P
        </div>
        <span className="font-display text-xl tracking-wider text-text-primary">LA POLLA 2026</span>
      </div>

      <div className="flex items-center gap-2">
        {showAdminUi && (
          <span className="text-[10px] bg-gold-400/15 text-gold-400 border border-gold-400/30 px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" /> Superadmin
          </span>
        )}
        {!isAuthenticated && !isSessionPending && (
          <Link
            href="/login"
            className="btn-gold inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase"
          >
            <LogIn className="w-3.5 h-3.5" />
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  );
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  isAuthenticated,
  isSessionPending,
}) => {
  const pathname = usePathname();
  // Simply use pathname for admin area check to avoid needing useSearchParams at this level
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  
  const mainClassName = isAdminArea
    ? 'flex-1 overflow-y-auto w-full max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8'
    : 'flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto';

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary">
      {/* Desktop Sidebar Navigation */}
      <SidebarNav isAuthenticated={isAuthenticated} isSessionPending={isSessionPending} />

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Participant preview is visual only; authorization continues to use the real session. */}
        <ParticipantViewBanner />

        {/* Mobile Header Bar */}
        <MobileHeader isAuthenticated={isAuthenticated} isSessionPending={isSessionPending} />

        {/* Dynamic Page Scroll Content */}
        <main className={mainClassName}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav isAuthenticated={isAuthenticated} />
    </div>
  );
};
