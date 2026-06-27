'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Eye, ArrowLeft, Shield } from 'lucide-react';

/**
 * Banner shown when a superadmin is browsing in participant-view mode.
 * Provides a clear visual indication and a way to return to admin view.
 *
 * This is purely a UI mode — the authenticated user and server-side permissions
 * remain unchanged.
 */
function ParticipantViewBannerInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  if (searchParams.get('view') !== 'participant') {
    return null;
  }

  // Build back-to-admin URL: strip the ?view=participant param from the current URL
  // and redirect to /admin
  const backHref = '/admin';

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
            — Estás viendo la app como participante. Tus permisos de administrador siguen activos.
          </span>
        </div>

        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-amber-300 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <Shield className="w-3.5 h-3.5" />
          Volver a vista admin
        </Link>
      </div>
    </div>
  );
}

export function ParticipantViewBanner() {
  return (
    <Suspense fallback={null}>
      <ParticipantViewBannerInner />
    </Suspense>
  );
}
