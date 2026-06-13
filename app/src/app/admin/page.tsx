import { redirect } from 'next/navigation';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { AppShell } from '../../components/layout/AppShell';
import { Shield, Settings, Trophy, Users, Calendar, ClipboardList } from 'lucide-react';
import Link from 'next/link';

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
    redirect('/liga');
  }

  // Fetch count stats
  const totalLeagues = await prisma.league.count();
  const totalMatches = await prisma.match.count();
  const totalUsers = await prisma.user.count();
  const totalPredictions = await prisma.prediction.count();

  // Fetch recent audit logs
  const logs = await prisma.adminActionLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          displayName: true,
          email: true,
        }
      }
    }
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto py-2">
        {/* Page Header */}
        <div className="flex items-center gap-3 pt-2 pb-1 border-b border-border-subtle">
          <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-wide text-text-primary">PANEL DE ADMINISTRACIÓN</h2>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Shield className="w-3.5 h-3.5 text-rank-up" />
              <span>Rol actual: Superadmin</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-muted uppercase font-mono font-bold flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" /> Ligas
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2">{totalLeagues}</p>
          </div>

          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-muted uppercase font-mono font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Partidos
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2">{totalMatches}</p>
          </div>

          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-muted uppercase font-mono font-bold flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Usuarios
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2">{totalUsers}</p>
          </div>

          <div className="card-base p-4 flex flex-col justify-between">
            <span className="text-[10px] text-text-muted uppercase font-mono font-bold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Pronósticos
            </span>
            <p className="text-2xl font-bold text-text-primary mt-2">{totalPredictions}</p>
          </div>
        </div>

        {/* Navigation / Actions List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-base p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gold-400 uppercase tracking-wider">Gestión Global</h3>
            <div className="flex flex-col gap-2">
              <Link href="/admin/resultados" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Ingresar Resultados</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/partidos" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Gestionar Horarios y Partidos</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/ligas" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Auditar Ligas Privadas</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
              <Link href="/admin/usuarios" className="w-full text-left px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover text-text-primary rounded-lg text-sm font-medium border border-border-default transition-all flex items-center justify-between">
                <span>Gestión de Permisos de Usuarios</span>
                <span className="text-xs text-text-muted">&rarr;</span>
              </Link>
            </div>
          </div>

          <div className="card-base p-5 space-y-4">
            <h3 className="font-semibold text-sm text-gold-400 uppercase tracking-wider">Registro de Auditoría Reciente</h3>
            <div className="divide-y divide-border-subtle max-h-[280px] overflow-y-auto text-xs space-y-2.5 pr-2">
              {logs.length === 0 ? (
                <p className="text-text-muted py-4 text-center">No hay registros de auditoría aún.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="pt-2.5 first:pt-0">
                    <div className="flex justify-between font-mono text-[10px] text-text-muted">
                      <span>{log.user.displayName || log.user.name}</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-text-primary font-semibold mt-0.5">{log.action}</p>
                    <p className="text-text-secondary text-[11px]">Objetivo: {log.target}</p>
                    {log.details && (
                      <pre className="mt-1 p-1 bg-background text-[10px] rounded overflow-x-auto text-text-muted font-mono whitespace-pre-wrap">
                        {log.details}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
