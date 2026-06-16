import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '../lib/auth-helpers';
import { prisma } from '../lib/db';
import { ArrowRight, Zap, Users, Award, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { JoinPoolForm } from '../components/league/JoinPoolForm';
import { FlagDisc } from '../components/ui/FlagDisc';
import { formatLeagueCurrency, currencySymbol } from '../lib/utils/currency';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!dbUser) {
    redirect('/login');
  }

  // 1. Check blocked status (rejected or disabled)
  if (dbUser.status === 'rejected' || dbUser.status === 'disabled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary px-4">
        <div className="max-w-md w-full card-base p-6 border-red-500/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl tracking-wide uppercase text-red-400">Acceso Restringido</h2>
          <p className="text-text-secondary text-sm">
            Tu cuenta ha sido deshabilitada o rechazada por el administrador de la polla.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="px-4 py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs uppercase font-mono tracking-widest transition-all"
            >
              Regresar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Check pending approval status
  if (dbUser.status === 'pending') {
    return (
      <>
        <div className="space-y-6 max-w-xl mx-auto py-8">
          <div className="card-base p-6 border-yellow-500/30 space-y-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500 text-xl font-bold font-mono">
              i
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl tracking-wide uppercase text-yellow-500">Cuenta en Espera</h2>
              <p className="text-xs text-text-secondary font-mono">Usuario: @{dbUser.username}</p>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              Tu cuenta se ha registrado correctamente y se encuentra **pendiente de aprobación** por parte del administrador.
            </p>
            <div className="bg-bg-secondary p-4 rounded-xl border border-border-default space-y-3 text-xs">
              <div>
                <h4 className="font-bold text-text-primary uppercase tracking-wider">¿Qué puedes hacer ahora?</h4>
                <ul className="list-disc pl-4 mt-1 space-y-1 text-text-muted">
                  <li>Navegar por este panel de bienvenida.</li>
                  <li>Actualizar tu perfil y contacto en <Link href="/cuenta" className="text-gold-400 hover:underline">Mi Cuenta</Link>.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-text-primary uppercase tracking-wider mt-2">Acceso limitado temporalmente:</h4>
                <ul className="list-disc pl-4 mt-1 space-y-1 text-text-muted">
                  <li>No puedes ingresar pronósticos de partidos.</li>
                  <li>No puedes unirte ni participar de los rankings.</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-text-muted italic">
              Una vez aprobado por el administrador, recibirás acceso completo de forma automática.
            </p>
          </div>
        </div>
      </>
    );
  }

  // 3. User is approved — Fetch memberships
  const memberships = await prisma.leagueMember.findMany({
    where: { userId: dbUser.id },
    include: {
      league: {
        include: {
          _count: {
            select: { members: true },
          },
        },
      },
    },
  });

  const membershipCount = memberships.length;

  // 4. Approved but has no pools
  if (membershipCount === 0 && !dbUser.isSuperadmin) {
    return (
      <>
        <div className="space-y-6 max-w-xl mx-auto py-8">
          <div className="card-base p-6 border-border-active space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-gold-400" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl tracking-wide uppercase text-text-primary">
                ¡HOLA, {dbUser.name.toUpperCase()}!
              </h2>
              <p className="text-xs text-text-secondary">Tu cuenta está aprobada, pero aún no perteneces a ninguna competencia.</p>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed max-w-md mx-auto">
              Para empezar a pronosticar y participar en los rankings, introduce el código de invitación que te proporcionó el administrador.
            </p>
            
            <div className="pt-2">
              <JoinPoolForm />
            </div>
          </div>
        </div>
      </>
    );
  }

  // 5. Approved and in at least one pool (or is superadmin)
  // Prefer default pool or take the first one
  const defaultLeague = await prisma.league.findFirst({
    where: { isDefault: true },
  });
  const activeMembership = memberships.find((m) => m.league.isDefault) || memberships[0];
  const league = activeMembership?.league || defaultLeague;

  if (!league) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="card-base p-6 text-center space-y-4">
          <p className="text-text-secondary">No hay competencias creadas todavía.</p>
          {dbUser.isSuperadmin && (
            <Link href="/admin" className="btn-gold text-xs py-2 px-4 inline-block font-mono uppercase tracking-widest text-gold-400 bg-gold-400/10 hover:bg-gold-400/20 border border-gold-500/30 rounded-xl transition-all">
              Ir a administración
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Fetch stats for this league
  const standing = await prisma.standing.findUnique({
    where: {
      leagueId_userId_block: {
        leagueId: league.id,
        userId: dbUser.id,
        block: 'global',
      },
    },
  });

  // Count predictions in this league
  const predictionCount = await prisma.prediction.count({
    where: {
      userId: dbUser.id,
      leagueId: league.id,
    },
  });

  // Next upcoming match and all matches (with predictions) to calculate pending predictions count
  const allMatches = await prisma.match.findMany({
    include: {
      predictions: {
        where: {
          userId: dbUser.id,
          leagueId: league.id,
        }
      }
    },
    orderBy: { kickoffUtc: 'asc' },
  });

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const nextMatch = allMatches.find(m => {
    const kickoffMs = typeof m.kickoffUtc === 'number' ? m.kickoffUtc : new Date(m.kickoffUtc).getTime();
    return kickoffMs > nowMs;
  }) || null;

  const pendingPredictionsCount = allMatches.filter(m => {
    const kickoffMs = typeof m.kickoffUtc === 'number' ? m.kickoffUtc : new Date(m.kickoffUtc).getTime();
    const isFuture = kickoffMs > nowMs;
    const isNotCancelledOrPostponed = m.resultStatus !== 'cancelled' && m.resultStatus !== 'postponed';
    const hasNoPrediction = m.predictions.length === 0;
    return isFuture && isNotCancelledOrPostponed && hasNoPrediction;
  }).length;

  // Count approved members in this league
  const approvedMembersCount = await prisma.leagueMember.count({
    where: {
      leagueId: league.id,
      user: { status: 'approved' },
    },
  });

  // Count inactive members in this league
  const inactiveMembersCount = await prisma.leagueMember.count({
    where: {
      leagueId: league.id,
      user: { status: { not: 'approved' } },
    },
  });

  const totalMembersCount = approvedMembersCount + inactiveMembersCount;

  // Calculate prize pool (Pozo)
  const estimatedPrizePool = league.prizePoolOverride ?? (approvedMembersCount * league.entryFee);

  const formattedName = dbUser.name.toUpperCase();

  return (
    <>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-1.5 pt-2">
          <h2 className="font-display text-3xl tracking-wide text-text-primary">
            ¡HOLA, {formattedName}!
          </h2>
          <p className="text-text-secondary text-sm">
            Bienvenido al panel principal de <span className="text-gold-400 font-bold">{league.name}</span>.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-base p-4 text-center">
            <p className="font-mono text-2xl font-bold text-gold-400">{standing?.points ?? 0}</p>
            <p className="text-[10px] text-text-muted uppercase font-mono mt-1">Puntos</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="font-mono text-2xl font-bold text-text-primary">{standing?.rank ?? '-'}</p>
            <p className="text-[10px] text-text-muted uppercase font-mono mt-1">Puesto</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="font-mono text-2xl font-bold text-text-primary">{predictionCount}</p>
            <p className="text-[10px] text-text-muted uppercase font-mono mt-1">Pronósticos</p>
          </div>
        </div>

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Main Section */}
          <div className="lg:col-span-7 space-y-4">
            {/* Next Match Card */}
            {nextMatch ? (
              <div className="card-base p-5 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">
                    Siguiente Partido
                  </h3>
                  <Link
                    href="/pronosticos"
                    className="text-xs text-gold-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    Ver todos <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-sans font-bold text-text-primary text-base">
                    <FlagDisc code={nextMatch.homeTeamCode} size={20} />
                    <span>{nextMatch.homeTeamCode}</span>
                    <span className="text-text-muted font-normal text-xs">vs</span>
                    <FlagDisc code={nextMatch.awayTeamCode} size={20} />
                    <span>{nextMatch.awayTeamCode}</span>
                  </span>
                  <span className="text-text-muted text-xs font-mono">
                    {new Date(nextMatch.kickoffUtc).toLocaleString('es-PE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Lima',
                    })} (Hora Lima)
                  </span>
                </div>
                <p className="text-xs text-text-muted">{nextMatch.venue} · {nextMatch.city}</p>
              </div>
            ) : (
              <div className="card-base p-6 text-center text-text-muted text-sm">
                No hay próximos partidos programados.
              </div>
            )}

            {/* Predictions Status / Quick Action */}
            <div className="card-base p-4 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-gold-400" />
                  {pendingPredictionsCount > 0
                    ? `Tienes ${pendingPredictionsCount} pronósticos pendientes`
                    : '¡Tienes todas tus predicciones completas!'}
                </h4>
                <p className="text-xs text-text-secondary mt-0.5">
                  Los partidos se bloquean en el sistema en el momento exacto del pitazo inicial (kickoff).
                </p>
              </div>
              <Link
                href="/pronosticos"
                className="btn-gold whitespace-nowrap self-start md:self-auto text-sm py-2 px-4 font-semibold uppercase tracking-wider"
              >
                Pronosticar ahora
              </Link>
            </div>
          </div>

          {/* Right / Side section */}
          <div className="lg:col-span-5 space-y-4">
            {/* Pool details / Prize info */}
            <div className="card-base p-5 space-y-4">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary border-b border-border-subtle pb-2">
                Resumen de Competencia
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Competencia Activa:</span>
                  <span className="font-bold text-text-primary">{league.name}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Participantes Activos:</span>
                  <span className="font-bold text-green-400 flex items-center gap-1">
                    <Users className="w-4 h-4" /> {approvedMembersCount}
                  </span>
                </div>

                {inactiveMembersCount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary">Miembros Inactivos:</span>
                    <span className="font-bold text-text-muted flex items-center gap-1">
                      {inactiveMembersCount}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Miembros Totales:</span>
                  <span className="font-bold text-text-primary flex items-center gap-1">
                    {totalMembersCount}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Cuota por Participante:</span>
                  <span className="font-mono font-bold text-text-primary">
                    {formatLeagueCurrency(league.entryFee, league.currency)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed border-border-subtle">
                  <span className="text-gold-400 font-semibold flex items-center gap-1">
                    <span className="text-base font-bold">{currencySymbol(league.currency)}</span> Pozo Estimado:
                  </span>
                  <span className="font-mono text-lg font-bold text-gold-400">
                    {formatLeagueCurrency(estimatedPrizePool, league.currency)}
                  </span>
                </div>
              </div>

              {league.payoutRules && (
                <div className="bg-bg-secondary p-3 rounded-lg border border-border-default space-y-1">
                  <span className="text-[9px] text-text-secondary uppercase font-mono font-bold flex items-center gap-1">
                    <Award className="w-3 h-3 text-gold-400" /> Reglas de Distribución:
                  </span>
                  <p className="text-[11px] text-text-muted leading-relaxed whitespace-pre-wrap">
                    {league.payoutRules}
                  </p>
                </div>
              )}
              
              <div className="text-center pt-2">
                <Link
                  href="/ranking"
                  className="text-xs text-gold-400 font-semibold hover:underline"
                >
                  Ver Clasificación Completa →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
