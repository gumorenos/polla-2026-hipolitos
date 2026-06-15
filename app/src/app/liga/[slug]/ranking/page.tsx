import React from 'react';
import { prisma } from '../../../../lib/db';
import { getCurrentSession } from '../../../../lib/auth-helpers';
export const dynamic = "force-dynamic";
import { redirect, notFound } from 'next/navigation';
import { RankingTable } from '../../../../components/league/RankingTable';
import Link from 'next/link';

export const metadata = {
  title: 'Ranking de Liga | La Polla 2026',
};

interface Params {
  slug: string;
}

interface SearchParams {
  showDisabled?: string;
}

export default async function LigaRankingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sParams = await searchParams;

  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;
  const showDisabled = sParams.showDisabled === 'true' && isSuperadmin;

  // Query league detail
  const league = await prisma.league.findUnique({
    where: { slug },
  });

  if (!league) {
    notFound();
  }

  // Enforce private league visibility: Only members or global Superadmins can view the league
  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId,
      },
    },
  });

  if (!membership && !isSuperadmin) {
    redirect('/liga');
  }

  // Query standings including user predictions for metadata
  const standings = await prisma.standing.findMany({
    where: {
      leagueId: league.id,
      block: 'global',
      user: {
        status: showDisabled ? { in: ['approved', 'disabled'] } : 'approved',
      }
    },
    include: {
      user: {
        include: {
          predictions: {
            where: { leagueId: league.id },
            orderBy: { updatedAt: 'desc' }
          }
        }
      },
    },
    orderBy: {
      rank: 'asc',
    },
  });

  // Fetch winner predictions to calculate match vs champion points breakdown
  const winnerPreds = await prisma.winnerPrediction.findMany({
    where: { leagueId: league.id },
  });

  const championPointsMap: Record<string, number> = {};
  winnerPreds.forEach((wp) => {
    championPointsMap[wp.userId] = wp.pointsEarned || 0;
  });

  const serializedStandings = standings.map((s) => {
    const predictionsCount = s.user.predictions.length;
    const lastPrediction = s.user.predictions[0];
    const lastUpdated = lastPrediction ? lastPrediction.updatedAt.toISOString() : s.user.createdAt.toISOString();
    const champPoints = championPointsMap[s.userId] || 0;
    const matchPoints = s.points - champPoints;

    return {
      userId: s.userId,
      displayName: s.user.displayName || s.user.name,
      points: s.points,
      champPoints,
      matchPoints,
      exacts: s.exacts,
      tendencies: s.tendencies,
      consolations: s.consolations,
      misses: s.misses,
      rank: s.rank,
      previousRank: s.previousRank,
      predictionsSubmitted: predictionsCount,
      lastUpdated: lastUpdated,
    };
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between pt-2">
          <div className="space-y-1">
            <h2 className="font-display text-3xl tracking-wide text-text-primary">
              Clasificación de {league.name}
            </h2>
            <p className="text-text-secondary text-sm">
              Tabla de posiciones global de la liga privada.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isSuperadmin && (
              <Link
                href={`/liga/${league.slug}/ranking?showDisabled=${!showDisabled}`}
                className="text-[10px] font-mono border border-border-default bg-bg-secondary px-3 py-1.5 rounded-lg text-text-secondary hover:text-gold-400 transition-all uppercase"
              >
                {showDisabled ? 'Ocultar Desactivados' : 'Mostrar Desactivados'}
              </Link>
            )}
            <Link href={`/liga/${league.slug}`} className="text-sm text-gold hover:underline">
              &larr; Volver al detalle
            </Link>
          </div>
        </div>

        <RankingTable standings={serializedStandings} currentUserId={userId} />
      </div>
    </>
  );
}

