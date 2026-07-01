import React from 'react';
import { RankingTable } from '../../components/league/RankingTable';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { buildChampionSurvivalTable, TeamTournamentStatusValue } from '../../lib/champion-survivor';
import { Trophy, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getEffectiveViewMode, shouldShowAdminUi, VIEW_MODE_COOKIE_NAME } from '../../lib/view-mode';

export const dynamic = "force-dynamic";

export const metadata = {
  title: 'Tabla de Clasificación | La Polla 2026',
};

interface SearchParams {
  league?: string;
  showDisabled?: string;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const sParams = await searchParams;
  const cookieStore = await cookies();
  const viewMode = getEffectiveViewMode(
    session.user.isSuperadmin === true,
    cookieStore.get(VIEW_MODE_COOKIE_NAME)?.value,
  );
  const showAdminControls = shouldShowAdminUi(session.user.isSuperadmin === true, viewMode);

  // Fetch all leagues user is in
  const allMemberships = await prisma.leagueMember.findMany({
    where: { userId },
    include: {
      league: true,
      user: true,
    }
  });
  const memberships = allMemberships.filter(m => m.league.competitionType !== 'match_pool');

  if (memberships.length === 0) {
    return (
      <>
        <div className="max-w-md mx-auto text-center space-y-4 py-12">
          <h2 className="font-display text-2xl text-gold">Sin Clasificación</h2>
          <p className="text-text-secondary text-sm">
            Aún no eres miembro de ninguna competencia. Crea una nueva competencia o únete a una existente con un código de invitación para competir.
          </p>
          <div className="pt-2">
            <Link href="/competencia" className="px-6 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold-light transition-colors">
              Ir a Competencias
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Determine active league
  const defaultLeague = memberships[0].league;
  const selectedLeagueId = sParams.league || defaultLeague.id;
  const selectedLeague = memberships.find(m => m.league.id === selectedLeagueId)?.league || defaultLeague;

  const showDisabled = sParams.showDisabled === 'true' && showAdminControls;

  // Fetch standings for selected league
  const standings = await prisma.standing.findMany({
    where: {
      leagueId: selectedLeague.id,
      block: 'global',
      user: {
        status: showDisabled ? { in: ['approved', 'disabled'] } : 'approved',
        memberships: {
          some: {
            leagueId: selectedLeague.id,
            isParticipant: true,
          },
        },
      }
    },
    include: {
      user: {
        include: {
          predictions: {
            where: { leagueId: selectedLeague.id },
            orderBy: { updatedAt: 'desc' }
          }
        }
      }
    },
    orderBy: {
      rank: 'asc'
    }
  });

  // Fetch winner predictions to calculate match vs champion points breakdown
  const winnerPreds = await prisma.winnerPrediction.findMany({
    where: { leagueId: selectedLeague.id },
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

  const participantMemberships = serializedStandings.length === 0
    ? await prisma.leagueMember.findMany({
        where: {
          leagueId: selectedLeague.id,
          isParticipant: true,
          user: {
            status: showDisabled ? { in: ['approved', 'disabled'] } : 'approved',
          },
        },
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      })
    : [];

  // Fallback standings if not computed yet
  const finalStandings = serializedStandings.length > 0 
    ? serializedStandings 
    : participantMemberships
        .map((m, index) => ({
          userId: m.userId,
          displayName: m.user.displayName || m.user.name || '',
          points: 0,
          champPoints: 0,
          matchPoints: 0,
          exacts: 0,
          tendencies: 0,
          consolations: 0,
          misses: 0,
          rank: index + 1,
          previousRank: index + 1,
          predictionsSubmitted: 0,
          lastUpdated: new Date().toISOString(),
        }));

  let serializedSurvivalTable: {
    userId: string;
    displayName: string;
    teamCode: string | null;
    teamName: string | null;
    position: number;
    statusLabel: string;
    roundLabel: string;
    eliminatedInMatchId: string | null;
  }[] = [];
  if (selectedLeague.competitionType === 'champion_survivor') {
    const members = await prisma.leagueMember.findMany({
      where: {
        leagueId: selectedLeague.id,
        user: {
          status: showDisabled ? { in: ['approved', 'disabled'] } : 'approved',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    const picks = await prisma.championPick.findMany({
      where: { leagueId: selectedLeague.id },
      include: {
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    const teamStatuses = await prisma.teamTournamentStatus.findMany({
      where: { leagueId: selectedLeague.id },
    });

    // Fetch finished/resolved matches to assist with on-the-fly elimination derivation
    const matches = await prisma.match.findMany({
      select: {
        id: true,
        phase: true,
        homeTeamCode: true,
        awayTeamCode: true,
        winnerTeamCode: true,
      },
    });

    const picksMap = new Map(picks.map(p => [p.userId, p]));
    const statusMap = new Map(teamStatuses.map(ts => [ts.teamCode, ts]));

    const tableInputs = members.map((m) => {
      const pick = picksMap.get(m.userId);
      const teamStatus = pick ? statusMap.get(pick.teamCode) : null;
      return {
        userId: m.userId,
        displayName: m.user.displayName || m.user.name,
        teamCode: pick?.teamCode ?? null,
        teamName: pick?.team?.name ?? null,
        teamStatus: teamStatus
          ? {
              teamCode: teamStatus.teamCode,
              status: teamStatus.status as TeamTournamentStatusValue,
              eliminatedAt: teamStatus.eliminatedAt,
              eliminatedInMatchId: teamStatus.eliminatedInMatchId,
              finalRank: teamStatus.finalRank,
            }
          : null,
      };
    });

    const survivalTable = buildChampionSurvivalTable(tableInputs, matches);
    serializedSurvivalTable = survivalTable.map((row) => ({
      userId: row.userId,
      displayName: row.displayName,
      teamCode: row.teamCode,
      teamName: row.teamName,
      position: row.position,
      statusLabel: row.statusLabel,
      roundLabel: row.roundLabel,
      eliminatedInMatchId: row.eliminatedInMatchId,
    }));
  }

  const currentStand = finalStandings.find(s => s.userId === userId) ?? finalStandings[0];
  const currentSurvivalRow = serializedSurvivalTable.find(row => row.userId === userId);

  const isSurvivor = selectedLeague.competitionType === 'champion_survivor';

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="space-y-1.5 pt-2">
          <h2 className="font-display text-3xl tracking-wide text-text-primary">TABLA DE CLASIFICACIÓN</h2>
          <p className="text-text-secondary text-sm">
            Compara tus puntos con los demás participantes de tus competencias.
          </p>
        </div>

        {/* League Selector Tabs */}
        <div className="flex gap-2 border-b border-border-subtle pb-3 overflow-x-auto">
          {memberships.map((m) => (
            <Link
              key={m.league.id}
              href={`/ranking?league=${m.league.id}${showDisabled ? '&showDisabled=true' : ''}`}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border shrink-0 ${
                selectedLeague.id === m.league.id
                  ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                  : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
              }`}
            >
              {m.league.name}
            </Link>
          ))}
        </div>

        {showAdminControls && (
          <div className="flex justify-end pt-1">
            <Link
              href={`/ranking?league=${selectedLeague.id}&showDisabled=${!showDisabled}`}
              className="text-[10px] font-mono border border-border-default bg-bg-secondary px-3 py-1.5 rounded-lg text-text-secondary hover:text-gold-400 transition-all uppercase"
            >
              {showDisabled ? 'Ocultar Desactivados' : 'Mostrar Desactivados'}
            </Link>
          </div>
        )}

        {/* League Quick Stats Widget */}
        {((isSurvivor && serializedSurvivalTable.length > 0) || (!isSurvivor && finalStandings.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-base p-4 flex items-center gap-3">
              <div className="p-2.5 bg-gold-400/10 border border-gold-500 rounded-lg text-gold-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono font-bold">
                  {isSurvivor ? 'Líder' : 'Líder'}
                </span>
                <p className="text-sm font-bold text-text-primary mt-0.5">
                  {isSurvivor ? (serializedSurvivalTable[0]?.displayName || '-') : finalStandings[0].displayName}
                </p>
              </div>
            </div>

            <div className="card-base p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Tu Puesto</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">
                  {isSurvivor
                    ? (currentSurvivalRow ? `#${currentSurvivalRow.position} de ${serializedSurvivalTable.length}` : '-')
                    : ` #${currentStand?.rank || '-'} de ${finalStandings.length}`
                  }
                </p>
              </div>
            </div>

            <div className="card-base p-4 flex items-center gap-3">
              <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono font-bold">
                  {isSurvivor ? 'Tu Estado' : 'Tu Puntaje'}
                </span>
                <p className="text-sm font-bold text-text-primary mt-0.5">
                  {isSurvivor
                    ? (currentSurvivalRow ? currentSurvivalRow.statusLabel : 'Sin selección')
                    : `${currentStand?.points || 0} Puntos`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Standings Table component */}
        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-wide uppercase text-text-primary">
            {isSurvivor ? 'Tabla de Supervivencia' : 'Clasificación'}
          </h3>
          <RankingTable
            competitionType={selectedLeague.competitionType}
            standings={finalStandings}
            survivalTable={serializedSurvivalTable}
            currentUserId={userId}
          />
        </div>
      </div>
    </>
  );
}
