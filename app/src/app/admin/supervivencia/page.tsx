import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Crown } from 'lucide-react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import {
  adminListChampionOddsSnapshots,
  getChampionSurvivorAdminState,
} from '../../../lib/actions/champion-survivor';
import { normalizeTeamStatus } from '../../../lib/champion-survivor';
import { calculateWorldCupQualification } from '../../../lib/fifa-qualification';
import { AdminChampionSurvivorClient, type ChampionSurvivorLeagueData } from './AdminChampionSurvivorClient';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Gestión Solo Campeón | La Polla 2026',
};

type RawActionResult = { success: true; data: unknown } | { error: string };

export default async function AdminChampionSurvivorPage() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isSuperadmin) {
    redirect('/competencia');
  }

  const leagues = await prisma.league.findMany({
    where: {
      competitionType: 'champion_survivor',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      championDeadline: true,
      currency: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const [teams, matches] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: 'asc' },
      select: { code: true, name: true },
    }),
    prisma.match.findMany({
      orderBy: { kickoffUtc: 'asc' },
    }),
  ]);
  const qualification = calculateWorldCupQualification(matches, teams);

  const leagueData = await Promise.all(
    leagues.map(async (league) => {
      const [adminStateResult, oddsResult, teamStatuses] = await Promise.all([
        getChampionSurvivorAdminState(league.id) as Promise<RawActionResult>,
        adminListChampionOddsSnapshots(league.id) as Promise<RawActionResult>,
        prisma.teamTournamentStatus.findMany({
          where: { leagueId: league.id },
          select: {
            teamCode: true,
            status: true,
            eliminatedAt: true,
            eliminatedInMatchId: true,
            finalRank: true,
            notes: true,
            updatedAt: true,
          },
        }),
      ]);

      if ('error' in adminStateResult) {
        return {
          league: serializeLeague(league),
          error: adminStateResult.error,
          teams: serializeTeamRows(teams, teamStatuses, qualification.teamTournamentStatusSuggestions),
          odds: [],
          picks: [],
          summary: null,
          distribution: { byTeam: [], mostPickedTeam: null, exclusivePicks: [] },
          simulation: null,
          prizePool: null,
        } satisfies ChampionSurvivorLeagueData;
      }

      const state = adminStateResult.data as {
        picks: ChampionSurvivorLeagueData['picks'];
        summary: ChampionSurvivorLeagueData['summary'];
        distribution: ChampionSurvivorLeagueData['distribution'];
        simulation: ChampionSurvivorLeagueData['simulation'];
        prizePool: ChampionSurvivorLeagueData['prizePool'];
      };

      const oddsData = 'success' in oddsResult
        ? (oddsResult.data as Array<{
            team: { code: string; name: string };
            latestSnapshot: {
              id: string;
              teamCode: string;
              provider: string;
              bookmaker: string;
              decimalOdds: number;
              impliedProbability: number;
              capturedAt: Date | string;
            } | null;
          }>)
        : [];

      return {
        league: serializeLeague(league),
        error: null,
        teams: serializeTeamRows(teams, teamStatuses, qualification.teamTournamentStatusSuggestions),
        odds: oddsData.map((row) => ({
          team: row.team,
          latestSnapshot: row.latestSnapshot
            ? {
                id: row.latestSnapshot.id,
                teamCode: row.latestSnapshot.teamCode,
                provider: row.latestSnapshot.provider,
                bookmaker: row.latestSnapshot.bookmaker,
                decimalOdds: row.latestSnapshot.decimalOdds,
                impliedProbability: row.latestSnapshot.impliedProbability,
                capturedAt: new Date(row.latestSnapshot.capturedAt).toISOString(),
              }
            : null,
        })),
        picks: state.picks.map((pick) => ({
          ...pick,
          submittedAt: pick.submittedAt ? new Date(pick.submittedAt).toISOString() : null,
          lockedAt: pick.lockedAt ? new Date(pick.lockedAt).toISOString() : null,
          correctedAt: pick.correctedAt ? new Date(pick.correctedAt).toISOString() : null,
          eliminatedAt: pick.eliminatedAt ? new Date(pick.eliminatedAt).toISOString() : null,
        })),
        summary: state.summary,
        distribution: state.distribution,
        simulation: serializeSimulation(state.simulation),
        prizePool: state.prizePool,
      } satisfies ChampionSurvivorLeagueData;
    })
  );

  return (
    <div className="w-full space-y-6 py-2">
      <div className="flex items-center justify-between pb-1 border-b border-border-subtle pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 hover:bg-bg-hover rounded-xl text-text-secondary hover:text-text-primary transition-all border border-transparent hover:border-border-default"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-wide text-text-primary">GESTIÓN SOLO CAMPEÓN</h2>
            <p className="text-xs text-text-secondary">
              Administra picks, estados de selecciones, cuotas manuales y exportación CSV de Champion Survivor.
            </p>
          </div>
        </div>
      </div>

      <AdminChampionSurvivorClient
        leagues={leagues.map(serializeLeague)}
        leagueData={leagueData}
        allTeams={teams}
      />
    </div>
  );
}

function serializeSimulation(
  simulation: ChampionSurvivorLeagueData['simulation']
): ChampionSurvivorLeagueData['simulation'] {
  if (!simulation) return null;

  return {
    ...simulation,
    lastCapturedAt: simulation.lastCapturedAt ? new Date(simulation.lastCapturedAt).toISOString() : null,
    entries: simulation.entries.map((entry) => ({
      ...entry,
      capturedAt: entry.capturedAt ? new Date(entry.capturedAt).toISOString() : null,
    })),
  };
}

function serializeLeague(league: {
  id: string;
  name: string;
  slug: string;
  championDeadline: Date | null;
  currency: string;
}) {
  return {
    id: league.id,
    name: league.name,
    slug: league.slug,
    championDeadline: league.championDeadline ? league.championDeadline.toISOString() : null,
    currency: league.currency,
  };
}

function serializeTeamRows(
  teams: Array<{ code: string; name: string }>,
  teamStatuses: Array<{
    teamCode: string;
    status: string;
    eliminatedAt: Date | null;
    eliminatedInMatchId: string | null;
    finalRank: number | null;
    notes: string | null;
    updatedAt: Date;
  }>,
  qualificationSuggestions: Record<string, string>
) {
  const statusByTeam = new Map(teamStatuses.map((status) => [status.teamCode, status]));

  return teams.map((team) => {
    const status = statusByTeam.get(team.code);
    return {
      team,
      status: normalizeTeamStatus(status?.status),
      eliminatedAt: status?.eliminatedAt ? status.eliminatedAt.toISOString() : null,
      eliminatedInMatchId: status?.eliminatedInMatchId || null,
      finalRank: status?.finalRank || null,
      notes: status?.notes || null,
      updatedAt: status?.updatedAt ? status.updatedAt.toISOString() : null,
      qualificationSuggestion: qualificationSuggestions[team.code] || 'pending',
    };
  });
}
