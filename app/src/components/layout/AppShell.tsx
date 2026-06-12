import React from 'react';
import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';
import { Shield } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary">
      {/* Desktop Sidebar Navigation */}
      <SidebarNav />

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-14 bg-bg-tertiary border-b border-border-default flex items-center justify-between px-4 sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400 font-bold font-display text-lg tracking-wider">
              P
            </div>
            <span className="font-display text-xl tracking-wider text-text-primary">LA POLLA 2026</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-gold-400/15 text-gold-400 border border-gold-400/30 px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Superadmin
            </span>
          </div>
        </header>

        {/* Dynamic Page Scroll Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
