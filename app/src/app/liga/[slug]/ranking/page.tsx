import React from 'react';
import { prisma } from '../../../../lib/db';
import { getCurrentSession } from '../../../../lib/auth-helpers';
import { redirect, notFound } from 'next/navigation';
import { AppShell } from '../../../../components/layout/AppShell';
import { RankingTable } from '../../../../components/league/RankingTable';
import Link from 'next/link';

export const metadata = {
  title: 'Ranking de Liga | La Polla 2026',
};

interface Params {
  slug: string;
}

export default async function LigaRankingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;

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
    },
    include: {
      user: {
        include: {
          predictions: {
            orderBy: { updatedAt: 'desc' }
          }
        }
      },
    },
    orderBy: {
      rank: 'asc',
    },
  });

  const serializedStandings = standings.map((s) => {
    const predictionsCount = s.user.predictions.length;
    const lastPrediction = s.user.predictions[0];
    const lastUpdated = lastPrediction ? lastPrediction.updatedAt.toISOString() : s.user.createdAt.toISOString();

    return {
      userId: s.userId,
      displayName: s.user.displayName || s.user.name,
      points: s.points,
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
    <AppShell>
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
          <Link href={`/liga/${league.slug}`} className="text-sm text-gold hover:underline">
            &larr; Volver al detalle
          </Link>
        </div>

        <RankingTable standings={serializedStandings} currentUserId={userId} />
      </div>
    </AppShell>
  );
}
