'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CalendarCheck, Award, User, Settings } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Inicio', path: '/', icon: LayoutDashboard },
    { label: 'Ligas', path: '/liga', icon: Users },
    { label: 'Predicciones', path: '/pronosticos', icon: CalendarCheck },
    { label: 'Ranking', path: '/ranking', icon: Award },
    { label: 'Perfil', path: '/perfil', icon: User },
    { label: 'Admin', path: '/admin', icon: Settings, adminOnly: true },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-tertiary border-t border-border-default z-50 px-2 flex justify-around items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            href={item.path}
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
};
