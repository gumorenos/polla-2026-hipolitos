'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { RankingTable } from '../../../components/league/RankingTable';
import { MOCK_LEAGUES, MOCK_STANDINGS, MOCK_USER } from '../../../lib/mockData';
import { useParams, notFound } from 'next/navigation';
import { Users, DollarSign, ArrowLeft, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function LigaDetallePage() {
  const params = useParams();
  const slug = params.slug as string;

  const league = MOCK_LEAGUES.find((l) => l.slug === slug);

  if (!league) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back Link and Header */}
        <div className="space-y-4 pt-2">
          <Link href="/liga" className="text-xs text-text-secondary hover:text-gold-400 flex items-center gap-1.5 w-fit">
            <ArrowLeft className="w-4 h-4" /> Volver a ligas
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl tracking-wide text-text-primary uppercase">
                {league.name}
              </h2>
              <div className="flex items-center gap-4 text-xs text-text-secondary mt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gold-400" />
                  5 miembros
                </span>
                <span className="flex items-center gap-0.5">
                  <DollarSign className="w-3.5 h-3.5 text-gold-400" />
                  Premio total: ${league.pot} USD
                </span>
                <span className="font-mono bg-bg-secondary px-2 py-0.5 rounded border border-border-default">
                  CÓDIGO: {league.inviteCode}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/join/${league.inviteCode}`);
                alert('Enlace de invitación copiado al portapapeles');
              }}
              className="btn-ghost flex items-center gap-1.5 text-xs py-2 px-4"
            >
              <Share2 className="w-4 h-4" /> Compartir Enlace
            </button>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="space-y-4">
          <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Tabla de Posiciones</h3>
          <RankingTable standings={MOCK_STANDINGS} currentUserId={MOCK_USER.id} />
        </div>
      </div>
    </AppShell>
  );
}
