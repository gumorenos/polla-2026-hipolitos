import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { AppShell } from '../../../components/layout/AppShell';
import { OddsAdminClient } from './OddsAdminClient';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Administrar Cuotas y H2H | La Polla 2026',
};

export default async function AdminOddsPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperadmin) {
    redirect('/liga');
  }

  // Fetch all matches ordered by kickoff time
  const matches = await prisma.match.findMany({
    orderBy: { kickoffUtc: 'asc' },
    include: {
      homeTeam: true,
      awayTeam: true,
      h2hSnapshot: true,
    },
  });

  // Fetch latest global odds snapshots
  const globalOddsSnapshots = await prisma.oddsSnapshot.findMany({
    where: {
      visibility: 'global',
    },
    orderBy: { capturedAt: 'desc' },
  });

  interface FormattedOdds {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    bookmaker: string;
    capturedAt: string;
  }

  // Map odds to matches
  const globalOddsMap: Record<string, FormattedOdds> = {};
  const groupedSnapshots: Record<string, (typeof globalOddsSnapshots)> = {};


  for (const o of globalOddsSnapshots) {
    if (!groupedSnapshots[o.matchId]) {
      groupedSnapshots[o.matchId] = [];
    }
    const currentList = groupedSnapshots[o.matchId];
    if (currentList.length === 0 || currentList[0].capturedAt.getTime() === o.capturedAt.getTime()) {
      currentList.push(o);
    }
  }

  for (const [matchId, outcomes] of Object.entries(groupedSnapshots)) {
    const home = outcomes.find(o => o.outcomeType === 'home');
    const draw = outcomes.find(o => o.outcomeType === 'draw');
    const away = outcomes.find(o => o.outcomeType === 'away');

    if (home && draw && away) {
      globalOddsMap[matchId] = {
        homeOdds: home.decimalOdds,
        drawOdds: draw.decimalOdds,
        awayOdds: away.decimalOdds,
        bookmaker: home.bookmaker,
        capturedAt: home.capturedAt.toISOString(),
      };
    }
  }

  const serializedMatches = matches.map((m) => ({
    id: m.id,
    homeTeamCode: m.homeTeamCode,
    homeTeamName: m.homeTeam.name,
    awayTeamCode: m.awayTeamCode,
    awayTeamName: m.awayTeam.name,
    kickoffUtc: m.kickoffUtc.toISOString(),
    status: m.status,
    globalOdds: globalOddsMap[m.id] || null,
    h2h: m.h2hSnapshot
      ? {
          totalMatches: m.h2hSnapshot.totalMatches,
          homeWins: m.h2hSnapshot.homeWins,
          draws: m.h2hSnapshot.draws,
          awayWins: m.h2hSnapshot.awayWins,
        }
      : null,
  }));

  const apiStatus = {
    oddsApiIo: process.env.ODDS_API_IO_ENABLED === 'true' && !!process.env.ODDS_API_IO_KEY,
    theOddsApi: process.env.THE_ODDS_API_ENABLED === 'true' && !!process.env.THE_ODDS_API_KEY,
    apiFootball: process.env.API_FOOTBALL_ENABLED === 'true' && !!process.env.API_FOOTBALL_KEY,
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 py-2">
        {/* Page Header */}
        <div className="flex items-center justify-between pb-1 border-b border-border-subtle pt-2">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 hover:bg-bg-hover rounded-xl text-text-secondary hover:text-text-primary transition-all border border-transparent hover:border-border-default"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-3xl tracking-wide text-text-primary">GENTIÓN DE CUOTAS Y H2H</h2>
              <p className="text-xs text-text-secondary">Monitorea y actualiza las cuotas del mercado e historiales de los partidos.</p>
            </div>
          </div>
        </div>

        {/* Client UI Panel */}
        <OddsAdminClient matches={serializedMatches} apiStatus={apiStatus} />
      </div>
    </AppShell>
  );
}
