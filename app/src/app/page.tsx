import React from 'react';
import Link from 'next/link';
import { LogIn, Trophy, Users, Award, Calendar, Zap, Activity, Shield } from 'lucide-react';
import { prisma } from '../lib/db';
import { getCurrentSession } from '../lib/auth-helpers';
import {
  buildPickDistribution,
  buildSurvivalSummary,
  calculateChampionProbability,
  calculatePrizePool,
  getChampionPickStatus,
  normalizeTeamStatus,
  calculateIndividualExpectedValue,
  classifyChampionPick,
  simulateChampionOdds,
  ChampionOddsSimulationEntry,
} from '../lib/champion-survivor';
import { formatLeagueCurrency } from '../lib/utils/currency';
import { calculateWorldCupQualification } from '../lib/fifa-qualification';
import { MatchOddsBar } from '../components/ui/MatchOddsBar';
import { FifaClassificationEngine } from '../components/match/FifaClassificationEngine';
import { PublicDashboardTabs } from '../components/ui/PublicDashboardTabs';
import { FlagDisc } from '../components/ui/FlagDisc';
import type { TeamTournamentStatus, ChampionOddsSnapshot } from '@prisma/client';
import { TeamMarketAnalysisTable } from '../components/public/TeamMarketAnalysisTable';
import { filterRealTeams } from '../lib/public-team-market-analysis';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inicio | La Polla 2026',
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

type PublicSession = {
  user: {
    id: string;
    name: string;
    displayName?: string | null;
    status?: string | null;
    isSuperadmin?: boolean | null;
  };
} | null;

type PublicChampionPrediction = {
  id: string;
  userId: string;
  teamCode: string;
  user: {
    id: string;
    name: string;
    displayName: string | null;
  };
  team: {
    name: string;
  };
};

type PublicMatchPrediction = {
  id: string;
  userId: string;
  matchId: string;
  homePrediction: number;
  awayPrediction: number;
  pointsEarned: number | null;
  user: {
    id: string;
    name: string;
    displayName: string | null;
  };
};

type PublicPrizePool = {
  amount: number;
  estimated: boolean;
  currency: string;
};

type ChampionSurvivorStateSummary = {
  totalParticipants: number;
  alive: number;
  eliminated: number;
  pending: number;
  winners: number;
  combinedAliveProbability: number | null;
  combinedAliveProbabilityAvailable: boolean;
};

type PublicChampionPick = {
  id: string;
  userId: string;
  teamCode: string;
  submittedAt: Date | null;
  user: {
    id: string;
    name: string;
    displayName: string | null;
  };
  team: {
    name: string;
  };
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
    match.status === 'finished' ||
    (match.homeScore !== null && match.awayScore !== null)
  );
}

function getRequestNowMs(now: Date = new Date()): number {
  return now.getTime();
}

function getUpcomingPublicMatches(matches: PublicMatch[], nowMs: number): PublicMatch[] {
  return matches.filter((match) => !isFinishedMatch(match) && match.kickoffUtc.getTime() > nowMs);
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

export default async function PublicHome() {
  const session = await getCurrentSession();
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
        <GuestHeader session={session} />
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
          <LoginButton session={session} />
        </section>
      </div>
    );
  }

  const [
    approvedParticipants,
    matches,
    teams,
    teamStatuses,
    championOddsSnapshots,
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
    prisma.team.findMany({
      select: { code: true, name: true },
    }),
    prisma.teamTournamentStatus.findMany({
      where: { leagueId: league.id },
    }),
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

  const approvedUserIds = new Set(
    (await prisma.leagueMember.findMany({
      where: {
        leagueId: league.id,
        isParticipant: true,
        user: { status: 'approved' },
      },
      select: { userId: true },
    })).map(m => m.userId)
  );

  const requestNowMs = getRequestNowMs();
  const realTeams = filterRealTeams(teams);
  const publicMatches = await buildPublicMatches(matches, league.showOdds, league.showH2H);
  const playedMatches = publicMatches.filter(isFinishedMatch);
  const upcomingMatches = getUpcomingPublicMatches(publicMatches, requestNowMs);
  const prizePool = calculatePrizePool(league, approvedParticipants);

  const isChampionSurvivor = league.competitionType === 'champion_survivor';
  
  // Calculate FIFA Group classification standings using official engine
  const fifaMatches = matches.map(m => ({
    id: m.id,
    phase: m.phase,
    group: m.group,
    homeTeamCode: m.homeTeamCode,
    awayTeamCode: m.awayTeamCode,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    resultStatus: m.resultStatus,
  }));
  const fifaTeams = teams.map(t => ({
    code: t.code,
    name: t.name,
  }));
  const qualification = calculateWorldCupQualification(fifaMatches, fifaTeams);

  // Full prediction standings & winner predictions distribution
  const standings = isChampionSurvivor ? [] : await buildFullPredictionStandings(league.id);
  const championPredictionDistribution = isChampionSurvivor
    ? []
    : await buildWinnerPredictionDistribution(league.id);

  // Match Predictions for Full Prediction
  const matchPredictions = isChampionSurvivor
    ? []
    : await prisma.prediction.findMany({
        where: {
          leagueId: league.id,
          user: { status: 'approved' },
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

  const predictionsToShow = matchPredictions.filter(p => approvedUserIds.has(p.userId));
  
  // Winner predictions (champion picks for full prediction)
  const winnerPredictions = isChampionSurvivor
    ? []
    : await prisma.winnerPrediction.findMany({
        where: { leagueId: league.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          team: {
            select: {
              name: true,
            },
          },
        },
      });
  const championPredictionsToShow = winnerPredictions.filter(wp => approvedUserIds.has(wp.userId));

  // Champion Survivor State
  const championSurvivorState = isChampionSurvivor
    ? await buildChampionSurvivorState(league, approvedParticipants, teamStatuses, realTeams, championOddsSnapshots, approvedUserIds)
    : null;

  // Tabs layout
  const fullPredictionTabs = [
    { id: 'standings', label: 'Clasificación', icon: <Award className="w-4 h-4" /> },
    { id: 'predictions', label: 'Pronósticos por Partido', icon: <Zap className="w-4 h-4" /> },
    { id: 'fifa', label: 'Fase de Grupos FIFA', icon: <Activity className="w-4 h-4" /> },
    { id: 'matches', label: 'Fixture y Resultados', icon: <Calendar className="w-4 h-4" /> },
  ];

  const championSurvivorTabs = [
    { id: 'survival', label: 'Mapa de Supervivencia', icon: <Award className="w-4 h-4" /> },
    { id: 'picks', label: 'Picks por Participante', icon: <Users className="w-4 h-4" /> },
    { id: 'fifa', label: 'Fase de Grupos FIFA', icon: <Activity className="w-4 h-4" /> },
    { id: 'matches', label: 'Fixture y Resultados', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 py-4">
      <GuestHeader session={session} />

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
        <PublicDashboardTabs tabs={championSurvivorTabs}>
          {/* Tab 1: Mapa de Supervivencia */}
          <div className="space-y-6">
            <ChampionSurvivorSummaryCards state={championSurvivorState} prizePool={prizePool} showOdds={league.showOdds} />
            <TeamMarketAnalysisTable
              teamsReport={championSurvivorState.teamsReport}
              currency={prizePool.currency}
              showOdds={league.showOdds}
            />
          </div>

          {/* Tab 2: Picks por Participante */}
          <ChampionSurvivorPicksList picks={championSurvivorState.picksToShow} statusByTeam={championSurvivorState.statusByTeam} />

          {/* Tab 3: Fase de Grupos FIFA */}
          <FifaClassificationEngine qualification={qualification} />

          {/* Tab 4: Fixture y Resultados */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MatchList
              title="Resultados recientes"
              emptyText="Todavía no hay resultados registrados."
              matches={[...playedMatches].sort((a, b) => b.kickoffUtc.getTime() - a.kickoffUtc.getTime())}
              showOdds={league.showOdds}
              showH2H={league.showH2H}
            />
            <MatchList
              title="Próximos partidos"
              emptyText="No hay próximos partidos disponibles."
              matches={upcomingMatches}
              showOdds={league.showOdds}
              showH2H={league.showH2H}
            />
          </div>
        </PublicDashboardTabs>
      ) : (
        <PublicDashboardTabs tabs={fullPredictionTabs}>
          {/* Tab 1: Clasificación */}
          <FullPredictionPublicDashboard
            standings={standings}
            championDistribution={championPredictionDistribution}
            championPredictions={championPredictionsToShow}
          />

          {/* Tab 2: Pronósticos por Partido */}
          <FullPredictionMatchPredictionsList
            matches={publicMatches}
            predictions={predictionsToShow}
          />

          {/* Tab 3: Fase de Grupos FIFA */}
          <FifaClassificationEngine qualification={qualification} />

          {/* Tab 4: Fixture y Resultados */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MatchList
              title="Resultados recientes"
              emptyText="Todavía no hay resultados registrados."
              matches={[...playedMatches].sort((a, b) => b.kickoffUtc.getTime() - a.kickoffUtc.getTime())}
              showOdds={league.showOdds}
              showH2H={league.showH2H}
            />
            <MatchList
              title="Próximos partidos"
              emptyText="No hay próximos partidos disponibles."
              matches={upcomingMatches}
              showOdds={league.showOdds}
              showH2H={league.showH2H}
            />
          </div>
        </PublicDashboardTabs>
      )}
    </div>
  );
}

function GuestHeader({ session }: { session: PublicSession }) {
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
      <LoginButton session={session} />
    </header>
  );
}

function LoginButton({ session }: { session: PublicSession }) {
  if (session?.user) {
    return (
      <Link href="/pronosticos" className="btn-gold inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider">
        Ir a mis pronósticos
      </Link>
    );
  }
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
  championPredictions,
}: {
  standings: PublicStanding[];
  championDistribution: Array<{ teamCode: string; teamName: string; count: number; percentage: number }>;
  championPredictions: PublicChampionPrediction[];
}) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 card-base overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-bg-secondary/40">
          <h2 className="font-display text-xl tracking-wide uppercase text-text-primary">Tabla de Posiciones</h2>
          <span className="text-[10px] text-text-muted font-mono uppercase">Global</span>
        </div>
        {standings.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">Todavía no hay ranking público para esta competencia.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="text-[9px] font-mono uppercase text-text-muted bg-black/10 border-b border-border-subtle/50">
                <tr>
                  <th className="px-4 py-2 text-center w-12">Pos</th>
                  <th className="px-4 py-2">Participante</th>
                  <th className="px-4 py-2 text-center">Predicciones</th>
                  <th className="px-4 py-2 text-center">Exactos</th>
                  <th className="px-4 py-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/40">
                {standings.map((standing) => (
                  <tr key={standing.userId} className="hover:bg-bg-hover/30 transition-colors">
                    <td className="px-4 py-3 text-center font-mono font-bold text-gold-400">#{standing.rank}</td>
                    <td className="px-4 py-3 font-semibold text-text-primary">{standing.displayName}</td>
                    <td className="px-4 py-3 text-center font-mono text-text-secondary">{standing.predictionsSubmitted}</td>
                    <td className="px-4 py-3 text-center font-mono text-text-secondary">{standing.exacts}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">{standing.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Champion pick distribution */}
        <div className="card-base overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-bg-secondary/40">
            <h2 className="font-display text-xl tracking-wide uppercase text-text-primary">Distribución Campeón</h2>
          </div>
          {championDistribution.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">Todavía no hay picks de campeón elegidos.</p>
          ) : (
            <div className="divide-y divide-border-subtle/40">
              {championDistribution.map((item) => (
                <div key={item.teamCode} className="p-3 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-text-primary">{item.teamName}</span>
                  <span className="font-mono text-xs text-text-secondary">{item.count} · {formatPercent(item.percentage)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User by user champion selection */}
        <div className="card-base overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-bg-secondary/40">
            <h2 className="font-display text-xl tracking-wide uppercase text-text-primary">Picks de Campeón</h2>
          </div>
          {championPredictions.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">Ningún participante ha seleccionado campeón aún.</p>
          ) : (
            <div className="divide-y divide-border-subtle/40">
              {championPredictions.map((wp) => (
                <div key={wp.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-text-secondary truncate">{wp.user.displayName || wp.user.name}</span>
                  <span className="font-mono text-xs text-gold-400 font-bold uppercase">{wp.team.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FullPredictionMatchPredictionsList({
  matches,
  predictions,
}: {
  matches: PublicMatch[];
  predictions: PublicMatchPrediction[];
}) {
  const predictionsByMatch = new Map<string, typeof predictions>();
  for (const pred of predictions) {
    const list = predictionsByMatch.get(pred.matchId) || [];
    list.push(pred);
    predictionsByMatch.set(pred.matchId, list);
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border-subtle pb-2">
        <h3 className="font-display text-xl text-gold-400 uppercase">Pronósticos de los Participantes</h3>
        <p className="text-xs text-text-secondary">Visualiza lo que cada participante pronosticó para cada partido en la competencia.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map((match) => {
          const preds = predictionsByMatch.get(match.id) || [];
          return (
            <div key={match.id} className="card-base p-4 space-y-3 bg-bg-secondary/35">
              <div className="flex justify-between items-start border-b border-border-subtle/40 pb-2">
                <div>
                  <p className="text-xs font-bold text-text-primary">
                    {match.homeTeamName} vs {match.awayTeamName}
                  </p>
                  <p className="text-[10px] text-text-muted font-mono uppercase">
                    {matchPhaseLabel(match.phase)} · {match.jornada}
                  </p>
                </div>
                {isFinishedMatch(match) ? (
                  <span className="font-mono text-xs font-bold text-gold-400 bg-gold-400/10 px-2 py-0.5 rounded">
                    F: {match.homeScore} - {match.awayScore}
                  </span>
                ) : (
                  <span className="text-[9px] font-mono uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                    Pendiente
                  </span>
                )}
              </div>

              {preds.length === 0 ? (
                <p className="text-[10px] text-text-muted italic">No hay pronósticos registrados para este partido.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {preds.map((p) => (
                    <div key={p.id} className="bg-black/15 p-1.5 rounded border border-border-subtle/20 flex justify-between items-center text-[11px]">
                      <span className="text-text-secondary truncate max-w-[80px]" title={p.user.displayName || p.user.name}>
                        {p.user.displayName || p.user.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-text-primary">{p.homePrediction} - {p.awayPrediction}</span>
                        {p.pointsEarned !== null && p.pointsEarned !== undefined && (
                          <span className="text-[9px] font-mono text-gold-400 font-bold">({p.pointsEarned}p)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChampionSurvivorSummaryCards({
  state,
  prizePool,
  showOdds,
}: {
  state: { summary: ChampionSurvivorStateSummary };
  prizePool: PublicPrizePool;
  showOdds: boolean;
}) {
  const summary = state.summary;
  return (
    <div className="card-base p-5 space-y-4">
      <div>
        <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">Mapa de supervivencia</h2>
        <p className="text-xs text-text-secondary">Resumen consolidado de picks y estados. Exclusivamente de lectura.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label="Total participantes" value={String(summary.totalParticipants)} />
        <MetricCard label="Vivos" value={String(summary.alive)} />
        <MetricCard label="Eliminados" value={String(summary.eliminated)} />
        <MetricCard label="Sin selección" value={String(summary.pending)} />
        <MetricCard label="Ganadores" value={String(summary.winners)} />
        {showOdds ? (
          <MetricCard
            label="Prob. Vivos"
            value={summary.combinedAliveProbabilityAvailable && summary.combinedAliveProbability !== null
              ? formatPercent(summary.combinedAliveProbability)
              : 'No disponible'}
          />
        ) : (
          <MetricCard label="Pozo estimado" value={formatLeagueCurrency(prizePool.amount, prizePool.currency)} />
        )}
      </div>
    </div>
  );
}

function ChampionSurvivorPicksList({
  picks,
  statusByTeam,
}: {
  picks: PublicChampionPick[];
  statusByTeam: Map<string, TeamTournamentStatus>;
}) {
  return (
    <div className="card-base overflow-hidden">
      <div className="px-4 py-3 bg-bg-secondary/60 border-b border-border-subtle flex justify-between items-center">
        <h3 className="font-display text-lg uppercase tracking-wide text-text-primary">Picks por Participante</h3>
        <span className="text-[10px] text-text-muted font-mono uppercase">Detallado</span>
      </div>
      {picks.length === 0 ? (
        <p className="p-6 text-sm text-text-secondary">Todavía no hay picks registrados en la competencia.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="text-[9px] font-mono uppercase text-text-muted bg-black/10 border-b border-border-subtle/50">
              <tr>
                <th className="px-4 py-2">Participante</th>
                <th className="px-4 py-2">Campeón Elegido</th>
                <th className="px-4 py-2 text-center w-24">Estado Pick</th>
                <th className="px-4 py-2 text-right">Fecha Selección</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40">
              {picks.map((pick) => {
                const teamStatus = statusByTeam.get(pick.teamCode);
                const pickStatus = getChampionPickStatus(pick, teamStatus);
                return (
                  <tr key={pick.id} className="hover:bg-bg-hover/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-text-primary">{pick.user.displayName || pick.user.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-text-primary">{pick.team.name}</span>
                      <span className="ml-1 text-[10px] text-text-muted font-mono uppercase">({pick.teamCode})</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase ${
                        pickStatus === 'winner'
                          ? 'border-gold-500/50 bg-gold-400/10 text-gold-400'
                          : pickStatus === 'eliminated'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-green-500/30 bg-green-500/10 text-green-400'
                      }`}>
                        {pickStatus === 'winner' ? 'Ganador' : pickStatus === 'eliminated' ? 'Eliminado' : 'Vivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-muted">
                      {pick.submittedAt ? formatDate(new Date(pick.submittedAt)) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchList({
  title,
  emptyText,
  matches,
  showOdds,
  showH2H,
}: {
  title: string;
  emptyText: string;
  matches: PublicMatch[];
  showOdds: boolean;
  showH2H: boolean;
}) {
  return (
    <section className="card-base overflow-hidden">
      <div className="p-4 border-b border-border-subtle bg-bg-secondary/40">
        <h2 className="font-display text-xl tracking-wide uppercase text-text-primary">{title}</h2>
      </div>
      {matches.length === 0 ? (
        <p className="p-6 text-sm text-text-secondary">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border-subtle/40 max-h-[600px] overflow-y-auto pr-1">
          {matches.map((match) => (
            <div key={match.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <FlagDisc code={match.homeTeamCode} size={16} />
                    <span>{match.homeTeamName}</span>
                    <span className="text-text-muted font-normal text-xs">vs</span>
                    <FlagDisc code={match.awayTeamCode} size={16} />
                    <span>{match.awayTeamName}</span>
                  </div>
                  <p className="text-[10px] text-text-muted font-mono">
                    {matchPhaseLabel(match.phase)} · {match.jornada} · {formatDate(match.kickoffUtc)} (Hora Lima)
                  </p>
                  <p className="text-[10px] text-text-secondary">{match.venue} · {match.city}</p>
                </div>
                {isFinishedMatch(match) ? (
                  <span className="font-mono text-sm font-bold text-gold-400 bg-gold-400/10 px-2.5 py-1 border border-gold-500/20 rounded-lg whitespace-nowrap">
                    {match.homeScore ?? '-'} - {match.awayScore ?? '-'}
                  </span>
                ) : (
                  <span className="text-[9px] font-mono uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Próximo
                  </span>
                )}
              </div>
              {showOdds && match.odds && !isFinishedMatch(match) && (
                <div className="rounded-lg border border-border-subtle bg-black/15 p-2 text-[10px] font-mono text-text-secondary space-y-1">
                  <p className="uppercase tracking-wider text-gold-400 font-bold text-[9px]">Odds del partido</p>
                  <MatchOddsBar
                    homeOdds={match.odds.homeOdds}
                    drawOdds={match.odds.drawOdds}
                    awayOdds={match.odds.awayOdds}
                    homeProbability={match.odds.homeProbability}
                    drawProbability={match.odds.drawProbability}
                    awayProbability={match.odds.awayProbability}
                    bookmaker={match.odds.bookmaker}
                  />
                </div>
              )}
              {showH2H && match.h2h && !isFinishedMatch(match) && (
                <div className="rounded-lg border border-border-subtle bg-black/15 p-2 text-[10px] font-mono text-text-secondary">
                  <p className="uppercase tracking-wider text-gold-400 font-bold text-[9px] mb-1">Historial H2H</p>
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
  approvedParticipants: number,
  teamStatuses: TeamTournamentStatus[],
  teams: Array<{ code: string; name: string }>,
  championOddsSnapshots: ChampionOddsSnapshot[],
  approvedUserIds: Set<string>
) {
  const realTeamCodes = new Set(teams.map((team) => team.code));
  const teamNames = Object.fromEntries(teams.map((team) => [team.code, team.name]));
  const realTeamStatuses = teamStatuses.filter((status) => realTeamCodes.has(status.teamCode));
  const statusByTeam = new Map(realTeamStatuses.map((status) => [status.teamCode, status]));

  const picks = await prisma.championPick.findMany({
    where: { leagueId: league.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  });
  const picksToShow = picks.filter((pick) => (
    approvedUserIds.has(pick.userId) && realTeamCodes.has(pick.teamCode)
  ));
  const pickByUser = new Map(picksToShow.map((pick) => [pick.userId, pick]));

  const latestOddsByTeam = new Map<string, ChampionOddsSnapshot>();
  for (const snapshot of championOddsSnapshots) {
    if (realTeamCodes.has(snapshot.teamCode) && !latestOddsByTeam.has(snapshot.teamCode)) {
      latestOddsByTeam.set(snapshot.teamCode, snapshot);
    }
  }

  const prizePool = calculatePrizePool(league, approvedParticipants);
  const entries = Array.from(approvedUserIds).map((userId) => {
    const pick = pickByUser.get(userId) || null;
    const teamStatus = pick ? statusByTeam.get(pick.teamCode) : null;
    const status = getChampionPickStatus(pick, teamStatus);
    const probability = pick && league.showOdds
      ? calculateChampionProbability(latestOddsByTeam.get(pick.teamCode), prizePool.amount)
      : calculateChampionProbability(null, prizePool.amount);

    return {
      userId: userId,
      status,
      teamCode: pick?.teamCode || null,
      submittedAt: pick?.submittedAt || null,
      eliminatedAt: teamStatus?.eliminatedAt || null,
      championProbability: probability.impliedProbability,
      expectedValue: probability.expectedValue,
    };
  });

  const distribution = buildPickDistribution(picksToShow, realTeamStatuses, approvedParticipants);
  const summary = buildSurvivalSummary(entries, prizePool);

  // Build teamreport with simulation data
  const picksCounts = new Map<string, number>();
  for (const pick of picksToShow) {
    if (pick.teamCode) {
      picksCounts.set(pick.teamCode, (picksCounts.get(pick.teamCode) || 0) + 1);
    }
  }

  const sortedByPicks = Array.from(teams)
    .map(t => ({ code: t.code, count: picksCounts.get(t.code) || 0 }))
    .sort((a, b) => b.count - a.count);
  const popularityRankByTeam = new Map<string, number>();
  sortedByPicks.forEach((item, index) => {
    if (item.count > 0) {
      popularityRankByTeam.set(item.code, index + 1);
    }
  });

  const simulation = league.showOdds
    ? simulateChampionOdds({
        leagueId: league.id,
        oddsSnapshots: Array.from(latestOddsByTeam.values()),
        teamStatuses: realTeamStatuses,
        teamNames: teamNames,
        iterations: 10000,
      })
    : null;

  const simulationEntryByTeam = new Map<string, ChampionOddsSimulationEntry>();
  if (simulation?.entries) {
    for (const entry of simulation.entries) {
      simulationEntryByTeam.set(entry.teamCode, entry);
    }
  }

  const teamsReport = teams.map((team) => {
    const pickCount = picksCounts.get(team.code) || 0;
    const pickPercentage = approvedParticipants > 0 ? pickCount / approvedParticipants : 0;
    const teamStatus = statusByTeam.get(team.code) || null;
    const status = normalizeTeamStatus(teamStatus?.status);
    const oddsSnapshot = latestOddsByTeam.get(team.code) || null;
    
    const probabilityResult = calculateChampionProbability(oddsSnapshot, prizePool.amount);
    const classification = classifyChampionPick({
      probability: probabilityResult.impliedProbability,
      pickCount,
      pickPercentage,
      popularityRank: popularityRankByTeam.get(team.code) || null,
      isExclusive: pickCount === 1,
    });

    const simEntry = simulationEntryByTeam.get(team.code) || null;

    return {
      teamCode: team.code,
      teamName: team.name,
      status,
      pickCount,
      pickPercentage,
      classificationLabel: classification.label,
      classificationKey: classification.key,
      marketProbability: probabilityResult.impliedProbability,
      decimalOdds: probabilityResult.decimalOdds,
      simulatedProbability: simEntry ? simEntry.simulatedProbability : null,
      expectedValue: probabilityResult.expectedValue,
      individualExpectedValue: calculateIndividualExpectedValue(prizePool.amount, probabilityResult.impliedProbability, pickCount),
    };
  });

  const statusWeight = {
    champion: 0,
    active: 1,
    unknown: 2,
    runner_up: 3,
    eliminated: 4,
  };

  teamsReport.sort((a, b) => {
    const wA = statusWeight[a.status] ?? 2;
    const wB = statusWeight[b.status] ?? 2;
    if (wA !== wB) return wA - wB;
    if (b.pickCount !== a.pickCount) return b.pickCount - a.pickCount;
    return a.teamName.localeCompare(b.teamName);
  });

  return {
    teamNames,
    distribution,
    summary: {
      ...summary,
      combinedAliveProbability: league.showOdds ? summary.combinedAliveProbability : null,
      combinedAliveProbabilityAvailable: league.showOdds && summary.combinedAliveProbabilityAvailable,
    },
    teamsReport,
    picksToShow,
    statusByTeam,
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
