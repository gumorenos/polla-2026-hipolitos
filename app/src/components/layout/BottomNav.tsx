'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Users, CalendarCheck, Award, User, Settings } from 'lucide-react';
import { authClient } from '../../lib/auth-client';

function BottomNavInner() {
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
    { label: 'Admin', path: '/admin', icon: Settings, adminOnly: true },
  ];

  // In participant-view mode, hide the admin nav item
  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return isSuperadmin && !isParticipantView;
    }
    return true;
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-tertiary border-t border-border-default z-50 px-2 flex justify-around items-center">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
        const href = isParticipantView ? `${item.path}?view=participant` : item.path;
        return (
          <Link
            key={item.path}
            href={href}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all ${
              isActive ? 'text-gold-400 font-bold scale-105' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const BottomNav: React.FC = () => {
  return (
    <Suspense fallback={
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-tertiary border-t border-border-default z-50 px-2 flex justify-around items-center" />
    }>
      <BottomNavInner />
    </Suspense>
  );
};
