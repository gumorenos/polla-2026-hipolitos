'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Users, CalendarCheck, Award, User, Settings, Shield, Eye } from 'lucide-react';
import { authClient } from '../../lib/auth-client';

function SidebarNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const isSuperadmin = session?.user?.isSuperadmin === true;
  const isParticipantView = searchParams.get('view') === 'participant';

  const navItems = [
    { label: 'Inicio', path: '/', icon: LayoutDashboard },
    { label: 'Competencias', path: '/competencia', icon: Users },
    { label: 'Predicciones', path: '/pronosticos', icon: CalendarCheck },
    { label: 'Ranking', path: '/ranking', icon: Award },
    { label: 'Perfil', path: '/perfil', icon: User },
    { label: 'Panel Admin', path: '/admin', icon: Settings, adminOnly: true },
  ];

  // In participant-view mode, hide the admin nav item
  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return isSuperadmin && !isParticipantView;
    }
    return true;
  });

  // Build participant-view URL for the current page or default to /pronosticos
  const participantViewHref = '/pronosticos?view=participant';

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
              href={isParticipantView ? `${item.path}?view=participant` : item.path}
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
        {isSuperadmin && !isParticipantView && (
          <Link
            href={participantViewHref}
            className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-dashed border-amber-500/30 hover:border-amber-500/50"
          >
            <Eye className="w-5 h-5 flex-shrink-0" />
            <span>Ver como participante</span>
          </Link>
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
              {isSuperadmin && !isParticipantView ? (
                <>
                  <Shield className="w-3 h-3 text-gold-400" /> Superadmin
                </>
              ) : isSuperadmin && isParticipantView ? (
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
    </aside>
  );
}

export const SidebarNav: React.FC = () => {
  return (
    <Suspense fallback={
      <aside className="hidden md:flex flex-col w-64 h-screen bg-bg-tertiary border-r border-border-default sticky top-0 p-4" />
    }>
      <SidebarNavInner />
    </Suspense>
  );
};
