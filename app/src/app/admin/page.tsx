import { redirect } from 'next/navigation';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { Shield, Settings, Trophy, Users, Calendar, ClipboardList, ShieldAlert, CheckCircle, AlertCircle, Award, Crown } from 'lucide-react';
import Link from 'next/link';
import { RecalculateButton } from './RecalculateButton';
import { formatLeagueCurrency } from '../../lib/utils/currency';
import { ViewModeSwitchButton } from '../../components/layout/ViewModeSwitchButton';

export const dynamic = "force-dynamic";
export const metadata = {
  title: 'Panel de Administración | La Polla 2026',
};

export default async function AdminDashboardPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isSuperadmin) {
    redirect('/competencia');
  }

  // 1. User stats
  const totalUsers = await prisma.user.count();
  const pendingUsers = await prisma.user.count({ where: { status: 'pending' } });
  const approvedUsers = await prisma.user.count({ where: { status: 'approved' } });
  const blockedUsers = await prisma.user.count({ where: { status: { in: ['rejected', 'disabled'] } } });

  // 2. League stats
  const totalLeagues = await prisma.league.count();
  const defaultLeague = await prisma.league.findFirst({ where: { isDefault: true } });
  
  let defaultLeagueMembersCount = 0;
  let defaultLeagueFee = 0;
  let defaultLeagueCurrency = 'PEN';
  let defaultLeaguePrize = 0;
  
  if (defaultLeague) {
    defaultLeagueMembersCount = await prisma.leagueMember.count({
      where: { leagueId: defaultLeague.id, user: { status: 'approved' } }
    });
    defaultLeagueFee = defaultLeague.entryFee;
    defaultLeagueCurrency = defaultLeague.currency;
    defaultLeaguePrize = defaultLeague.prizePoolOverride ?? (defaultLeagueMembersCount * defaultLeague.entryFee);
  }

  // Count approved users not in any pool
  const userMemberships = await prisma.leagueMember.findMany({ select: { userId: true } });
  const userWithPoolIds = Array.from(new Set(userMemberships.map(m => m.userId)));
  const usersWithoutPool = await prisma.user.count({
    where: {
      status: 'approved',
      id: { notIn: userWithPoolIds }
    }
  });

  // 3. Predictions stats
  const totalPredictions = await prisma.prediction.count();

  // 4. Matches stats
  const totalMatches = await prisma.match.count();
  const openMatchesCount = await prisma.match.count({ where: { status: { in: ['open', 'soon'] } } });
  const finishedMatchesCount = await prisma.match.count({
    where: {
      status: 'result',
      resultStatus: 'final',
      homeScore: { not: null },
      awayScore: { not: null },
    },
  });
  
  // Matches past kickoff but status is not result/finished
  const allNotFinished = await prisma.match.findMany({
    where: {
      OR: [
        { status: { not: 'result' } },
        { resultStatus: { not: 'final' } },
        { homeScore: null },
        { awayScore: null },
      ],
    },
  });
  const resultsPending = allNotFinished.filter(
    (m) => new Date(m.kickoffUtc) < new Date()
  ).length;

  // Fetch recent audit logs
  const logs = await prisma.adminActionLog.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          displayName: true,
          email: true,
          username: true,
        }
      }
    }
  });

  // Find last ranking calculation log
  const lastRecalcLog = await prisma.adminActionLog.findFirst({
    where: { action: { in: ['update_match_result', 'ranking_recalculation'] } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <div className="space-y-6 w-full py-2">
        {/* Page Header */}
        <div className="flex items-center justify-between pt-2 pb-1 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-3xl tracking-wide text-text-primary">PANEL DE CONTROL</h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Shield className="w-3.5 h-3.5 text-rank-up" />
                <span>Superadmin General</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ViewModeSwitchButton
              targetMode="participant"
              redirectTo="/pronosticos"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 text-xs font-mono font-semibold uppercase tracking-wider transition-colors"
            />
            <RecalculateButton />
          </div>
        </div>

        {/* Global Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-gold-400" /> Usuarios
            </span>
            <div className="mt-2 space-y-1">
              <p className="text-2xl font-bold text-text-primary">{totalUsers}</p>
              <div className="flex flex-wrap gap-x-2 text-[9px] text-text-muted uppercase font-mono">
                <span className="text-green-400 font-semibold">{approvedUsers} Aprob.</span>
                <span className="text-yellow-400">{pendingUsers} Pend.</span>
                {blockedUsers > 0 && <span className="text-red-400">{blockedUsers} Bloq.</span>}
              </div>
            </div>
          </div>

          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5 text-gold-400" /> Competencias
            </span>
            <div className="mt-2 space-y-1">
              <p className="text-2xl font-bold text-text-primary">{totalLeagues}</p>
              <p className="text-[9px] text-text-muted uppercase font-mono truncate">
                Por Defecto: {defaultLeague ? defaultLeague.name : 'Ninguna'}
              </p>
            </div>
          </div>

          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gold-400" /> Partidos
            </span>
            <div className="mt-2 space-y-1">
              <p className="text-2xl font-bold text-text-primary">{totalMatches}</p>
              <div className="flex gap-2 text-[9px] text-text-muted uppercase font-mono">
                <span>{finishedMatchesCount} Fin.</span>
                <span className={resultsPending > 0 ? "text-yellow-400 font-bold" : ""}>
                  {resultsPending} Pend.
                </span>
                <span>{openMatchesCount} Abiertos</span>
              </div>
            </div>
          </div>

          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-gold-400" /> Pronósticos
            </span>
            <div className="mt-2 space-y-1">
              <p className="text-2xl font-bold text-text-primary">{totalPredictions}</p>
              <p className="text-[9px] text-text-muted uppercase font-mono">
                Sin Competencia: {usersWithoutPool} Aprobados
              </p>
            </div>
          </div>
        </div>

        {/* Default Pool Summary Block */}
        {defaultLeague && (
          <div className="card-base p-5 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-2">
              <h3 className="font-display text-xl tracking-wide uppercase text-gold-400 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-green-400" /> Competencia Principal: {defaultLeague.name}
              </h3>
              <span className="text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded-full uppercase">
                Activa
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-text-muted">Miembros Aprobados:</span>
                <p className="font-bold text-text-primary flex items-center gap-1">
                  <Users className="w-4 h-4 text-gold-400" /> {defaultLeagueMembersCount} participantes
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-text-muted">Cuota de Entrada:</span>
                <p className="font-mono font-bold text-text-primary">
                  {formatLeagueCurrency(defaultLeagueFee, defaultLeagueCurrency)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gold-400 font-semibold flex items-center gap-1">
                  <Award className="w-4 h-4" /> Pozo Estimado:
                </span>
                <p className="font-mono font-bold text-gold-400 text-base">
                  {formatLeagueCurrency(defaultLeaguePrize, defaultLeagueCurrency)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation / Actions List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-base p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gold-400 uppercase tracking-wider">Gestión Administrativa</h3>
            <div className="flex flex-col gap-2">
              <Link href="/admin/resultados" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Ingresar Resultados de Partidos</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/partidos" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Configurar Kickoffs y Fechas</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/usuarios" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Aprobación y Gestión de Usuarios</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/ligas" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Auditar y Configurar Competencias</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/odds" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Gestionar Cuotas de Mercado e H2H</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/recordatorios" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Auditar y Configurar Recordatorios</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/campeon" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Corregir Elección de Campeón</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/supervivencia" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-gold-400" /> Gestión Solo Campeón
                </span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
            </div>
          </div>

          <div className="card-base p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm text-gold-400 uppercase tracking-wider">Bitácora de Auditoría</h3>
              {lastRecalcLog && (
                <span className="text-[9px] text-text-muted font-mono">
                  Posiciones: {new Date(lastRecalcLog.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="divide-y divide-border-subtle max-h-[220px] overflow-y-auto text-xs space-y-2.5 pr-2">
              {logs.length === 0 ? (
                <p className="text-text-muted py-4 text-center">No hay registros de auditoría aún.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="pt-2.5 first:pt-0">
                    <div className="flex justify-between font-mono text-[10px] text-text-muted">
                      <span>@{log.user.username || log.user.name}</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-text-primary font-semibold mt-0.5">{log.action}</p>
                    <p className="text-text-secondary text-[11px]">Objetivo: {log.target}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
