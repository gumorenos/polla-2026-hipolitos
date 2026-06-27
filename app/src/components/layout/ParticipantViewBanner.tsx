'use client';

import { usePathname } from 'next/navigation';
import { Eye } from 'lucide-react';
import { useViewMode } from './ViewModeProvider';
import { ViewModeSwitchButton } from './ViewModeSwitchButton';

/**
 * Banner shown when a superadmin is browsing in participant-view mode.
 * Provides a clear visual indication and a way to return to admin view.
 *
 * This is purely a UI mode — the authenticated user and server-side permissions
 * remain unchanged.
 */
export function ParticipantViewBanner() {
  const pathname = usePathname();
  const { isParticipantPreview } = useViewMode();

  if (!isParticipantPreview) {
    return null;
  }

  const description = pathname.startsWith('/admin')
    ? 'Las herramientas administrativas siguen disponibles porque eres superadmin.'
    : 'Estás viendo la app con la interfaz de un participante. Tus permisos reales no cambian.';

  return (
    <div
      className="sticky top-0 z-50 w-full border-b border-amber-500/40 bg-amber-500/10 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-300 text-xs">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono font-semibold uppercase tracking-wider">
            Vista de participante activa
          </span>
          <span className="hidden sm:inline text-amber-200/70 font-normal normal-case tracking-normal">
            {description}
          </span>
        </div>

        <ViewModeSwitchButton
          targetMode="admin"
          redirectTo="/admin"
          className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
        />
      </div>
    </div>
  );
}
