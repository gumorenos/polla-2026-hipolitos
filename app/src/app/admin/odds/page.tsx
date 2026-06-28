import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { OddsAdminClient } from './OddsAdminClient';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { lastOddsError } from '../../../lib/odds/providers';
import { lastH2hError } from '../../../lib/odds/h2h';
import { getProviderAdminSummaries } from '../../../lib/provider-credentials';

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
    redirect('/competencia');
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
    group: m.group,
    phase: m.phase,
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

  // Fetch latest global odds snapshot (that is not simulated, so provider !== 'simulator')
  const latestOddsSnapshot = await prisma.oddsSnapshot.findFirst({
    where: {
      visibility: 'global',
      provider: { not: 'simulator' },
    },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true },
  });

  // Fetch latest H2H snapshot (that is not simulated)
  const latestH2hSnapshot = await prisma.headToHeadSnapshot.findFirst({
    where: {
      provider: { not: 'simulator' },
    },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true },
  });

  const lastSuccessfulOdds = latestOddsSnapshot?.capturedAt ? latestOddsSnapshot.capturedAt.toISOString() : null;
  const lastSuccessfulH2h = latestH2hSnapshot?.capturedAt ? latestH2hSnapshot.capturedAt.toISOString() : null;

  // Count of real and simulated odds snapshots
  const realOddsCount = await prisma.oddsSnapshot.count({
    where: {
      provider: { not: 'simulator' },
      bookmaker: { not: 'LaPolla 2026 Simulator' },
    },
  });

  const simulatedOddsCount = await prisma.oddsSnapshot.count({
    where: {
      OR: [
        { provider: 'simulator' },
        { bookmaker: 'LaPolla 2026 Simulator' },
      ],
    },
  });

  // Count of real and simulated H2H snapshots
  const realH2hCount = await prisma.headToHeadSnapshot.count({
    where: {
      provider: { not: 'simulator' },
    },
  });

  const simulatedH2hCount = await prisma.headToHeadSnapshot.count({
    where: {
      provider: 'simulator',
    },
  });

  // Global & Private count
  const globalOddsCount = await prisma.oddsSnapshot.count({
    where: { visibility: 'global' }
  });
  const privateOddsCount = await prisma.oddsSnapshot.count({
    where: { visibility: 'user_private' }
  });

  const realSnapshotsCount = { odds: realOddsCount, h2h: realH2hCount };
  const simulatedSnapshotsCount = { odds: simulatedOddsCount, h2h: simulatedH2hCount };

  const oddsDisplayEnabled = process.env.ODDS_DISPLAY_ENABLED === 'true';
  const oddsManualUserRefreshEnabled = process.env.ODDS_MANUAL_USER_REFRESH_ENABLED === 'true';

  const providerConfiguration = await getProviderAdminSummaries();
  const providerConfigured = new Map(
    providerConfiguration.providers.map((provider) => [provider.provider, provider.configured]),
  );
  const apiStatus = {
    oddsApiIo: providerConfigured.get('odds-api-io') ?? false,
    theOddsApi: providerConfigured.get('the-odds-api') ?? false,
    apiFootball: providerConfigured.get('api-football') ?? false,
    simulatedAllowed: process.env.ODDS_ALLOW_SIMULATED_DATA === 'true',
  };
  const [
    mappingTeams,
    teamAliasCount,
    providerTeamOutcomes,
    teamAliases,
    distinctSnapshotTeams,
    matchedOutrightsCount,
    pendingOutrightsCount,
    matchedOutrightTeams,
  ] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: 'asc' },
      select: { code: true, name: true },
    }),
    prisma.teamAlias.count(),
    prisma.providerTeamOutcome.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: 1000,
      include: {
        suggestedTeam: { select: { code: true, name: true } },
      },
    }),
    prisma.teamAlias.findMany({
      select: {
        id: true,
        teamCode: true,
        provider: true,
        alias: true,
      },
      orderBy: { teamCode: 'asc' },
    }),
    prisma.championOddsSnapshot.findMany({
      select: { teamCode: true },
      distinct: ['teamCode'],
    }),
    prisma.providerTeamOutcome.count({
      where: {
        provider: 'the-odds-api',
        marketType: 'outrights',
        status: 'matched',
      },
    }),
    prisma.providerTeamOutcome.count({
      where: {
        provider: 'the-odds-api',
        marketType: 'outrights',
        status: 'unmatched',
      },
    }),
    prisma.providerTeamOutcome.findMany({
      where: {
        provider: 'the-odds-api',
        marketType: 'outrights',
        status: 'matched',
        suggestedTeamCode: { not: null },
      },
      select: { suggestedTeamCode: true },
      distinct: ['suggestedTeamCode'],
    }),
  ]);

  const snapshotTeamCodes = new Set(distinctSnapshotTeams.map((t) => t.teamCode));
  const matchedOutrightTeamCodes = matchedOutrightTeams.map((t) => t.suggestedTeamCode as string);
  const matchedOutrightsWithoutSnapshot = matchedOutrightTeamCodes.filter(
    (code) => !snapshotTeamCodes.has(code)
  );
  const championOddsSavedCount = distinctSnapshotTeams.length;

  const serializedProviderTeamOutcomes = providerTeamOutcomes.map((outcome) => ({
    id: outcome.id,
    provider: outcome.provider,
    marketType: outcome.marketType,
    rawName: outcome.rawName,
    normalizedName: outcome.normalizedName,
    status: outcome.status,
    confidence: outcome.confidence,
    reason: outcome.reason,
    suggestedTeamCode: outcome.suggestedTeamCode,
    suggestedTeamName: outcome.suggestedTeam?.name ?? null,
    firstSeenAt: outcome.firstSeenAt.toISOString(),
    lastSeenAt: outcome.lastSeenAt.toISOString(),
  }));

  // Compute future matches count and next future match details
  const now = new Date();
  const futureMatchesList = matches.filter(m => new Date(m.kickoffUtc) > now);
  const futureMatchesCount = futureMatchesList.length;
  const nextFutureMatch = futureMatchesList[0] 
    ? {
        id: futureMatchesList[0].id,
        homeTeamCode: futureMatchesList[0].homeTeamCode,
        homeTeamName: futureMatchesList[0].homeTeam.name,
        awayTeamCode: futureMatchesList[0].awayTeamCode,
        awayTeamName: futureMatchesList[0].awayTeam.name,
        kickoffUtc: futureMatchesList[0].kickoffUtc.toISOString(),
      }
    : null;

  // Future matches without global odds
  const matchesWithGlobalOdds = await prisma.match.findMany({
    where: {
      kickoffUtc: { gt: now },
      oddsSnapshots: {
        some: { visibility: 'global' }
      }
    },
    select: { id: true }
  });
  const matchesWithGlobalOddsIds = new Set(matchesWithGlobalOdds.map(m => m.id));
  const futureMatchesWithoutGlobalOddsCount = futureMatchesList.filter(m => !matchesWithGlobalOddsIds.has(m.id)).length;

  // Future matches without H2H
  const futureMatchesWithoutH2HCount = futureMatchesList.filter(m => !m.h2hSnapshot).length;

  // Fetch provider cooldowns/statuses
  const providerStatuses = await prisma.providerStatus.findMany();
  const cooldownMap = providerStatuses.reduce((acc, status) => {
    acc[status.provider] = {
      cooldownUntil: status.cooldownUntil.toISOString(),
      lastStatus: status.lastStatus,
      lastErrorMessage: status.lastErrorMessage,
      updatedAt: status.updatedAt.toISOString(),
    };
    return acc;
  }, {} as Record<string, { cooldownUntil: string; lastStatus: number | null; lastErrorMessage: string | null; updatedAt: string }>);

  // Last fallback success
  const latestFallbackSuccess = await prisma.oddsSnapshot.findFirst({
    where: {
      provider: 'the-odds-api',
      sourceType: 'api',
    },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true }
  });
  const lastFallbackSuccessTime = latestFallbackSuccess?.capturedAt ? latestFallbackSuccess.capturedAt.toISOString() : null;

  return (
    <>
      <div className="w-full space-y-6 py-2">
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
              <h2 className="font-display text-3xl tracking-wide text-text-primary">GESTIÓN DE CUOTAS Y H2H</h2>
              <p className="text-xs text-text-secondary">Monitorea y actualiza las cuotas del mercado e historiales de los partidos.</p>
            </div>
          </div>
        </div>

        {/* Client UI Panel */}
        <OddsAdminClient
          matches={serializedMatches}
          apiStatus={apiStatus}
          lastSuccessfulOdds={lastSuccessfulOdds}
          lastSuccessfulH2h={lastSuccessfulH2h}
          lastOddsError={lastOddsError}
          lastH2hError={lastH2hError}
          realSnapshotsCount={realSnapshotsCount}
          simulatedSnapshotsCount={simulatedSnapshotsCount}
          oddsDisplayEnabled={oddsDisplayEnabled}
          oddsManualUserRefreshEnabled={oddsManualUserRefreshEnabled}
          futureMatchesCount={futureMatchesCount}
          nextFutureMatch={nextFutureMatch}
          globalOddsCount={globalOddsCount}
          privateOddsCount={privateOddsCount}
          futureMatchesWithoutGlobalOddsCount={futureMatchesWithoutGlobalOddsCount}
          futureMatchesWithoutH2HCount={futureMatchesWithoutH2HCount}
          cooldownMap={cooldownMap}
          lastFallbackSuccessTime={lastFallbackSuccessTime}
          providerConfigs={providerConfiguration.providers}
          encryptionConfigured={providerConfiguration.encryptionConfigured}
          mappingTeams={mappingTeams}
          teamAliasCount={teamAliasCount}
          providerTeamOutcomes={serializedProviderTeamOutcomes}
          teamAliases={teamAliases}
          championOddsSavedCount={championOddsSavedCount}
          matchedOutrightsCount={matchedOutrightsCount}
          pendingOutrightsCount={pendingOutrightsCount}
          matchedOutrightsWithoutSnapshot={matchedOutrightsWithoutSnapshot}
        />
      </div>
    </>
  );
}
