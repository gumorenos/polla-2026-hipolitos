import React from 'react';
import Link from 'next/link';
import { LogIn, Shield, Trophy } from 'lucide-react';
import { prisma } from '../../lib/db';
import {
  buildPickDistribution,
  buildSurvivalSummary,
  calculateChampionProbability,
  calculatePrizePool,
  getChampionPickStatus,
} from '../../lib/champion-survivor';
import { formatLeagueCurrency } from '../../lib/utils/currency';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vista de Invitado | La Polla 2026',
};

type PublicStanding = {
  userId: string;
  displayName: string;
  rank: number;
  previousRank: number;
  points: number;
  exacts: number;
  tendencies: number;
  consolations: number;
  misses: number;
  predictionsSubmitted: number;
  champPoints: number;
  matchPoints: number;
};

type PublicMatch = {
  id: string;
  phase: string;
  jornada: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffUtc: Date;
  status: string;
  resultStatus: string | null;
  venue: string;
  city: string;
  odds?: {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    homeProbability: number;
    drawProbability: number;
    awayProbability: number;
    bookmaker: string;
    capturedAt: Date;
  } | null;
  h2h?: {
    totalMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
  } | null;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: Date): string {
  return value.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isFinishedMatch(match: { resultStatus: string | null; status: string; homeScore: number | null; awayScore: number | null }): boolean {
  return (
    match.resultStatus === 'final' ||
    match.status === 'result' ||
    (match.homeScore !== null && match.awayScore !== null)
  );
}

function getTournamentStatusLabel(status?: string | null): string {
  if (status === 'active') return 'Vivo';
  if (status === 'eliminated') return 'Eliminado';
  if (status === 'champion') return 'Campeón';
  if (status === 'runner_up') return 'Subcampeón';
  return 'Estado no definido';
}

function statusTone(status?: string | null): string {
  if (status === 'champion') return 'border-gold-500/50 bg-gold-400/10 text-gold-400';
  if (status === 'eliminated' || status === 'runner_up') return 'border-red-500/30 bg-red-500/10 text-red-400 opacity-70';
  if (status === 'active') return 'border-green-500/30 bg-green-500/10 text-green-400';
  return 'border-border-subtle bg-bg-secondary/30 text-text-secondary';
}

function matchPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    groups: 'Grupos',
    r32: '16avos',
    r16: 'Octavos',
    quarters: 'Cuartos',
    semis: 'Semifinal',
    final: 'Final',
  };
  return labels[phase] || phase;
}

export default async function GuestPage() {
  const league = await prisma.league.findFirst({
    where: {
      isDefault: true,
      isActive: true,
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!league) {
    return (
      <div className="space-y-6 py-4">
        <GuestHeader />
        <section className="card-base p-8 text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center mx-auto">
            <Trophy className="w-7 h-7 text-gold-400" />
          </div>
          <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">
            Aún no hay una competencia principal configurada.
          </h2>
          <p className="text-sm text-text-secondary">
            Cuando un administrador marque una competencia principal, esta vista pública mostrará su estado en modo invitado.
          </p>
          <LoginButton />
        </section>
      </div>
    );
  }

  const [
    approvedParticipants,
    matches,
  ] = await Promise.all([
    prisma.leagueMember.count({
      where: {
        leagueId: league.id,
        isParticipant: true,
        user: { status: 'approved' },
      },
    }),
    prisma.match.findMany({
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
      orderBy: { kickoffUtc: 'asc' },
    }),
  ]);

  const publicMatches = await buildPublicMatches(matches, league.showOdds, league.showH2H);
  const playedMatches = publicMatches.filter(isFinishedMatch);
  const upcomingMatches = publicMatches.filter((match) => !isFinishedMatch(match) && match.kickoffUtc.getTime() > Date.now());
  const prizePool = calculatePrizePool(league, approvedParticipants);

  const isChampionSurvivor = league.competitionType === 'champion_survivor';
  const standings = isChampionSurvivor ? [] : await buildFullPredictionStandings(league.id);
  const championSurvivorState = isChampionSurvivor
    ? await buildChampionSurvivorState(league, approvedParticipants)
    : null;
  const championPredictionDistribution = isChampionSurvivor
    ? []
    : await buildWinnerPredictionDistribution(league.id);

  return (
    <div className="space-y-6 py-4">
      <GuestHeader />

      <section className="space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-gold-400">Vista pública de invitado</p>
            <h1 className="font-display text-3xl md:text-4xl tracking-wide text-text-primary uppercase">
              {league.name}
            </h1>
            <p className="text-sm text-text-secondary">
              Estado público de la competencia principal. Solo lectura, sin pronósticos ni acciones administrativas.
            </p>
          </div>
          <span className="w-fit rounded-full border border-border-default bg-bg-secondary/40 px-3 py-1 text-[10px] font-mono uppercase text-text-secondary">
            {isChampionSurvivor ? 'Solo campeón' : 'Polla completa'}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Participantes" value={String(approvedParticipants)} />
        <MetricCard label="Pozo estimado" value={formatLeagueCurrency(prizePool.amount, prizePool.currency)} />
        <MetricCard label="Partidos jugados" value={String(playedMatches.length)} />
        <MetricCard label="Próximos partidos" value={String(upcomingMatches.length)} />
      </section>

      {isChampionSurvivor && championSurvivorState ? (
        <ChampionSurvivorPublicDashboard
          state={championSurvivorState}
          showOdds={league.showOdds}
          prizePool={prizePool}
          getTeamName={(teamCode) => championSurvivorState.teamNames[teamCode] || teamCode}
        />
      ) : (
        <FullPredictionPublicDashboard
          standings={standings}
          championDistribution={championPredictionDistribution}
        />
      )}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MatchList
          title="Resultados recientes"
          emptyText="Todavía no hay resultados registrados."
          matches={[...playedMatches].sort((a, b) => b.kickoffUtc.getTime() - a.kickoffUtc.getTime()).slice(0, 6)}
        />
        <MatchList
          title="Próximos partidos"
          emptyText="No hay próximos partidos disponibles."
          matches={upcomingMatches.slice(0, 6)}
        />
      </section>
    </div>
  );
}

function GuestHeader() {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-500/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-gold-400" />
        </div>
        <div>
          <p className="font-display text-xl tracking-wide text-text-primary uppercase">La Polla Hipólitos 2026</p>
          <p className="text-xs text-text-secondary">Vista pública de solo lectura</p>
        </div>
      </div>
      <LoginButton />
    </header>
  );
}

function LoginButton() {
  return (
    <Link href="/login" className="btn-gold inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider">
      <LogIn className="w-4 h-4" />
      Iniciar sesión
    </Link>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-base p-4">
      <p className="text-[10px] font-mono uppercase text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function FullPredictionPublicDashboard({
  standings,
  championDistribution,
}: {
  standings: PublicStanding[];
  championDistribution: Array<{ teamCode: string; teamName: string; count: number; percentage: number }>;
}) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 card-base overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">Ranking</h2>
        </div>
        {standings.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">Todavía no hay ranking público para esta competencia.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {standings.slice(0, 12).map((standing) => (
              <div key={standing.userId} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm">
                <span className="col-span-1 font-mono font-bold text-gold-400">#{standing.rank}</span>
                <span className="col-span-5 font-semibold text-text-primary truncate">{standing.displayName}</span>
                <span className="col-span-2 text-center font-mono text-text-secondary">{standing.predictionsSubmitted} preds.</span>
                <span className="col-span-2 text-center font-mono text-text-secondary">{standing.exacts} exactos</span>
                <span className="col-span-2 text-right font-mono font-bold text-text-primary">{standing.points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-base overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">Campeón elegido</h2>
        </div>
        {championDistribution.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">Todavía no hay picks de campeón visibles.</p>
        ) : (
          <div className="divide-y divide-border-subtle/40">
            {championDistribution.slice(0, 8).map((item) => (
              <div key={item.teamCode} className="p-3 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-text-primary">{item.teamName}</span>
                <span className="font-mono text-text-secondary">{item.count} · {formatPercent(item.percentage)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ChampionSurvivorPublicDashboard({
  state,
  showOdds,
  prizePool,
  getTeamName,
}: {
  state: Awaited<ReturnType<typeof buildChampionSurvivorState>>;
  showOdds: boolean;
  prizePool: { amount: number; estimated: boolean; currency: string };
  getTeamName: (teamCode: string) => string;
}) {
  if (!state) return null;
  const summary = state.summary;

  return (
    <section className="space-y-6">
      <div className="card-base p-5 space-y-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">Mapa de supervivencia</h2>
          <p className="text-xs text-text-secondary">Estado agregado de Solo campeón. No incluye formularios ni acciones.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
          <MetricCard label="Total participantes" value={String(summary.totalParticipants)} />
          <MetricCard label="Vivos" value={String(summary.alive)} />
          <MetricCard label="Eliminados" value={String(summary.eliminated)} />
          <MetricCard label="Sin selección" value={String(summary.pending)} />
          <MetricCard label="Ganadores" value={String(summary.winners)} />
          <MetricCard label="Pozo estimado" value={formatLeagueCurrency(prizePool.amount, prizePool.currency)} />
          {showOdds && (
            <MetricCard
              label="Prob. vivos"
              value={summary.combinedAliveProbabilityAvailable && summary.combinedAliveProbability !== null
                ? formatPercent(summary.combinedAliveProbability)
                : 'No disponible'}
            />
          )}
        </div>
        {!showOdds && (
          <p className="text-[10px] text-text-muted italic">Las ayudas de mercado están desactivadas para esta competencia.</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-base overflow-hidden">
          <div className="p-4 border-b border-border-subtle">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Distribución de picks</h3>
          </div>
          {state.distribution.byTeam.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">Todavía no hay picks registrados.</p>
          ) : (
            <div className="divide-y divide-border-subtle/40">
              {state.distribution.byTeam.map((item) => (
                <div key={item.teamCode} className={`p-3 flex items-center justify-between gap-3 border-l-4 ${statusTone(item.status)}`}>
                  <div>
                    <p className="font-semibold">{getTeamName(item.teamCode)}</p>
                    <p className="text-[10px] font-mono">{getTournamentStatusLabel(item.status)}</p>
                  </div>
                  <span className="font-mono text-xs">{item.count} · {formatPercent(item.percentage)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-base overflow-hidden">
          <div className="p-4 border-b border-border-subtle">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Picks exclusivos</h3>
          </div>
          {state.distribution.exclusivePicks.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">No hay picks exclusivos por ahora.</p>
          ) : (
            <div className="p-4 flex flex-wrap gap-2">
              {state.distribution.exclusivePicks.map((item) => (
                <span key={item.teamCode} className={`text-xs font-mono px-2 py-1 rounded-full border ${statusTone(item.status)}`}>
                  {getTeamName(item.teamCode)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MatchList({ title, emptyText, matches }: { title: string; emptyText: string; matches: PublicMatch[] }) {
  return (
    <section className="card-base overflow-hidden">
      <div className="p-4 border-b border-border-subtle">
        <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">{title}</h2>
      </div>
      {matches.length === 0 ? (
        <p className="p-6 text-sm text-text-secondary">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border-subtle/40">
          {matches.map((match) => (
            <div key={match.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {match.homeTeamName} <span className="text-text-muted">vs</span> {match.awayTeamName}
                  </p>
                  <p className="text-[10px] text-text-muted font-mono">
                    {matchPhaseLabel(match.phase)} · {match.jornada} · {formatDate(match.kickoffUtc)} (Hora Lima)
                  </p>
                  <p className="text-[10px] text-text-secondary">{match.venue} · {match.city}</p>
                </div>
                {isFinishedMatch(match) ? (
                  <span className="font-mono text-sm font-bold text-gold-400 whitespace-nowrap">
                    {match.homeScore ?? '-'} - {match.awayScore ?? '-'}
                  </span>
                ) : (
                  <span className="text-[9px] font-mono uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Próximo
                  </span>
                )}
              </div>
              {match.odds && !isFinishedMatch(match) && (
                <div className="rounded-lg border border-border-subtle bg-black/10 p-2 text-[10px] font-mono text-text-secondary space-y-1">
                  <p className="uppercase tracking-wider text-gold-400 font-bold">Odds del partido</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>Local: <strong className="text-text-primary">{match.odds.homeOdds.toFixed(2)}</strong> ({formatPercent(match.odds.homeProbability)})</span>
                    <span>Empate: <strong className="text-text-primary">{match.odds.drawOdds.toFixed(2)}</strong> ({formatPercent(match.odds.drawProbability)})</span>
                    <span>Visita: <strong className="text-text-primary">{match.odds.awayOdds.toFixed(2)}</strong> ({formatPercent(match.odds.awayProbability)})</span>
                  </div>
                  <p className="text-[9px] text-text-muted">Bookmaker: {match.odds.bookmaker}</p>
                </div>
              )}
              {match.h2h && !isFinishedMatch(match) && (
                <div className="rounded-lg border border-border-subtle bg-black/10 p-2 text-[10px] font-mono text-text-secondary">
                  <p className="uppercase tracking-wider text-gold-400 font-bold">Historial H2H</p>
                  <p>
                    Partidos: <strong className="text-text-primary">{match.h2h.totalMatches}</strong> · {match.homeTeamCode}: {match.h2h.homeWins} · Empates: {match.h2h.draws} · {match.awayTeamCode}: {match.h2h.awayWins}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function buildFullPredictionStandings(leagueId: string): Promise<PublicStanding[]> {
  const [standings, winnerPreds] = await Promise.all([
    prisma.standing.findMany({
      where: {
        leagueId,
        block: 'global',
        user: { status: 'approved' },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            predictions: {
              where: { leagueId },
              select: { updatedAt: true },
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { rank: 'asc' },
    }),
    prisma.winnerPrediction.findMany({ where: { leagueId } }),
  ]);

  const championPointsByUser = new Map(winnerPreds.map((prediction) => [prediction.userId, prediction.pointsEarned || 0]));

  if (standings.length > 0) {
    return standings.map((standing) => {
      const champPoints = championPointsByUser.get(standing.userId) || 0;
      return {
        userId: standing.userId,
        displayName: standing.user.displayName || standing.user.name,
        rank: standing.rank,
        previousRank: standing.previousRank,
        points: standing.points,
        exacts: standing.exacts,
        tendencies: standing.tendencies,
        consolations: standing.consolations,
        misses: standing.misses,
        predictionsSubmitted: standing.user.predictions.length,
        champPoints,
        matchPoints: standing.points - champPoints,
      };
    });
  }

  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      isParticipant: true,
      user: { status: 'approved' },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          predictions: {
            where: { leagueId },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return members.map((member, index) => ({
    userId: member.userId,
    displayName: member.user.displayName || member.user.name,
    rank: index + 1,
    previousRank: index + 1,
    points: 0,
    exacts: 0,
    tendencies: 0,
    consolations: 0,
    misses: 0,
    predictionsSubmitted: member.user.predictions.length,
    champPoints: 0,
    matchPoints: 0,
  }));
}

async function buildWinnerPredictionDistribution(leagueId: string) {
  const [predictions, participants] = await Promise.all([
    prisma.winnerPrediction.findMany({
      where: { leagueId },
      include: { team: { select: { name: true } } },
    }),
    prisma.leagueMember.count({
      where: {
        leagueId,
        isParticipant: true,
        user: { status: 'approved' },
      },
    }),
  ]);

  const distribution = new Map<string, { teamCode: string; teamName: string; count: number }>();
  for (const prediction of predictions) {
    const current = distribution.get(prediction.teamCode) || {
      teamCode: prediction.teamCode,
      teamName: prediction.team.name,
      count: 0,
    };
    current.count += 1;
    distribution.set(prediction.teamCode, current);
  }

  return Array.from(distribution.values())
    .map((item) => ({
      ...item,
      percentage: participants > 0 ? item.count / participants : 0,
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.teamName.localeCompare(b.teamName);
    });
}

async function buildChampionSurvivorState(
  league: { id: string; entryFee: number; currency: string; prizePoolOverride: number | null; showOdds: boolean },
  approvedParticipants: number
) {
  const [members, picks, teamStatuses, teams, championOddsSnapshots] = await Promise.all([
    prisma.leagueMember.findMany({
      where: {
        leagueId: league.id,
        isParticipant: true,
        user: { status: 'approved' },
      },
      select: { userId: true },
    }),
    prisma.championPick.findMany({ where: { leagueId: league.id } }),
    prisma.teamTournamentStatus.findMany({ where: { leagueId: league.id } }),
    prisma.team.findMany({ select: { code: true, name: true } }),
    league.showOdds
      ? prisma.championOddsSnapshot.findMany({
          where: {
            leagueId: league.id,
            sourceMarket: 'outright_winner',
          },
          orderBy: { capturedAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const teamNames = Object.fromEntries(teams.map((team) => [team.code, team.name]));
  const statusByTeam = new Map(teamStatuses.map((status) => [status.teamCode, status]));
  const pickByUser = new Map(picks.map((pick) => [pick.userId, pick]));
  const latestOddsByTeam = new Map<string, (typeof championOddsSnapshots)[number]>();
  for (const snapshot of championOddsSnapshots) {
    if (!latestOddsByTeam.has(snapshot.teamCode)) latestOddsByTeam.set(snapshot.teamCode, snapshot);
  }

  const prizePool = calculatePrizePool(league, approvedParticipants);
  const entries = members.map((member) => {
    const pick = pickByUser.get(member.userId) || null;
    const teamStatus = pick ? statusByTeam.get(pick.teamCode) : null;
    const status = getChampionPickStatus(pick, teamStatus);
    const probability = pick && league.showOdds
      ? calculateChampionProbability(latestOddsByTeam.get(pick.teamCode), prizePool.amount)
      : calculateChampionProbability(null, prizePool.amount);

    return {
      userId: member.userId,
      status,
      teamCode: pick?.teamCode || null,
      submittedAt: pick?.submittedAt || null,
      eliminatedAt: teamStatus?.eliminatedAt || null,
      championProbability: probability.impliedProbability,
      expectedValue: probability.expectedValue,
    };
  });

  const distribution = buildPickDistribution(picks, teamStatuses, approvedParticipants);
  const summary = buildSurvivalSummary(entries, prizePool);

  return {
    teamNames,
    distribution,
    summary: {
      ...summary,
      combinedAliveProbability: league.showOdds ? summary.combinedAliveProbability : null,
      combinedAliveProbabilityAvailable: league.showOdds && summary.combinedAliveProbabilityAvailable,
    },
  };
}

async function buildPublicMatches(
  matches: Array<{
    id: string;
    phase: string;
    jornada: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffUtc: Date;
    status: string;
    resultStatus: string | null;
    venue: string;
    city: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
  }>,
  showOdds: boolean,
  showH2H: boolean
): Promise<PublicMatch[]> {
  const [oddsSnapshots, h2hSnapshots] = await Promise.all([
    showOdds
      ? prisma.oddsSnapshot.findMany({
          where: {
            provider: { not: 'simulator' },
            visibility: 'global',
            matchId: { in: matches.map((match) => match.id) },
          },
          orderBy: { capturedAt: 'desc' },
        })
      : Promise.resolve([]),
    showH2H
      ? prisma.headToHeadSnapshot.findMany({
          where: {
            provider: { not: 'simulator' },
            matchId: { in: matches.map((match) => match.id) },
          },
        })
      : Promise.resolve([]),
  ]);

  const oddsByMatch = new Map<string, PublicMatch['odds']>();
  const groupedOdds = new Map<string, typeof oddsSnapshots>();
  for (const snapshot of oddsSnapshots) {
    const current = groupedOdds.get(snapshot.matchId) || [];
    if (current.length === 0 || current[0].capturedAt.getTime() === snapshot.capturedAt.getTime()) {
      current.push(snapshot);
      groupedOdds.set(snapshot.matchId, current);
    }
  }

  for (const [matchId, snapshots] of groupedOdds.entries()) {
    const home = snapshots.find((snapshot) => snapshot.outcomeType === 'home');
    const draw = snapshots.find((snapshot) => snapshot.outcomeType === 'draw');
    const away = snapshots.find((snapshot) => snapshot.outcomeType === 'away');
    if (!home || !draw || !away) continue;
    oddsByMatch.set(matchId, {
      homeOdds: home.decimalOdds,
      drawOdds: draw.decimalOdds,
      awayOdds: away.decimalOdds,
      homeProbability: home.normalizedProbability ?? home.impliedProbability,
      drawProbability: draw.normalizedProbability ?? draw.impliedProbability,
      awayProbability: away.normalizedProbability ?? away.impliedProbability,
      bookmaker: home.bookmaker,
      capturedAt: home.capturedAt,
    });
  }

  const h2hByMatch = new Map(h2hSnapshots.map((snapshot) => [snapshot.matchId, {
    totalMatches: snapshot.totalMatches,
    homeWins: snapshot.homeWins,
    draws: snapshot.draws,
    awayWins: snapshot.awayWins,
  }]));

  return matches.map((match) => ({
    id: match.id,
    phase: match.phase,
    jornada: match.jornada,
    homeTeamCode: match.homeTeamCode,
    awayTeamCode: match.awayTeamCode,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    kickoffUtc: match.kickoffUtc,
    status: match.status,
    resultStatus: match.resultStatus,
    venue: match.venue,
    city: match.city,
    odds: oddsByMatch.get(match.id) || null,
    h2h: h2hByMatch.get(match.id) || null,
  }));
}
