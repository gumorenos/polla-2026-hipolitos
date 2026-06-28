'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CalendarCheck, Award, User, Settings, Shield, Eye, LogIn } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import { filterVisibleNavigationItems } from '../../lib/navigation';
import { useViewMode } from './ViewModeProvider';
import { ViewModeSwitchButton } from './ViewModeSwitchButton';

type SidebarNavProps = {
  isAuthenticated: boolean;
  isSessionPending: boolean;
};

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isAuthenticated,
  isSessionPending,
}) => {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { isParticipantPreview, showAdminUi } = useViewMode();

  const navItems = [
    { label: 'Inicio', path: '/', icon: LayoutDashboard },
    { label: 'Competencias', path: '/competencia', icon: Users, authenticatedOnly: true },
    { label: 'Predicciones', path: '/pronosticos', icon: CalendarCheck, authenticatedOnly: true },
    { label: 'Ranking', path: '/ranking', icon: Award, authenticatedOnly: true },
    { label: 'Perfil', path: '/perfil', icon: User, authenticatedOnly: true },
    { label: 'Panel Admin', path: '/admin', icon: Settings, authenticatedOnly: true, adminOnly: true },
  ];

  const visibleNavItems = filterVisibleNavigationItems(navItems, {
    isAuthenticated,
    showAdminUi,
  });

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-bg-tertiary border-r border-border-default sticky top-0 p-4">
      {/* Brand logo */}
      <div className="flex items-center gap-3 px-2 py-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400 font-bold font-display text-xl tracking-wider shadow-[0_0_15px_rgba(212,168,67,0.2)]">
          P
        </div>
        <div>
          <h1 className="font-display text-2xl leading-none text-text-primary tracking-wide">LA POLLA 2026</h1>
          <span className="text-[10px] text-text-secondary uppercase tracking-widest font-mono">Prediction Pool</span>
        </div>
      </div>

      {/* Main navigation list */}
      <nav className="flex-1 space-y-1">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gold-400/10 text-gold-400 border-l-4 border-gold-400'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Ver como participante — visible to superadmin when NOT in participant-view mode */}
        {showAdminUi && (
          <ViewModeSwitchButton
            targetMode="participant"
            redirectTo="/pronosticos"
            className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-dashed border-amber-500/30 hover:border-amber-500/50"
          />
        )}
      </nav>

      {/* Footer / User status widget */}
      {session?.user && (
        <div className="pt-4 border-t border-border-subtle flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center text-gold-400 font-mono text-sm font-bold uppercase">
            {session.user.name.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary truncate">
              {session.user.displayName || session.user.name}
            </p>
            <span className="text-[10px] text-text-secondary flex items-center gap-1">
              {showAdminUi ? (
                <>
                  <Shield className="w-3 h-3 text-gold-400" /> Superadmin
                </>
              ) : isParticipantPreview ? (
                <>
                  <Eye className="w-3 h-3 text-amber-400" /> Vista participante
                </>
              ) : (
                'Jugador'
              )}
            </span>
          </div>
        </div>
      )}
      {!isAuthenticated && !isSessionPending && (
        <Link
          href="/login"
          className="btn-gold mt-4 flex items-center justify-center gap-2 px-3 py-2 text-xs uppercase"
        >
          <LogIn className="w-4 h-4" />
          Iniciar sesión
        </Link>
      )}
    </aside>
  );
};
