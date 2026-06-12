'use client';

import React, { useState } from 'react';
import { AppShell } from '../layout/AppShell';
import { Shield, Settings, Archive, Trash2, ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { archiveLeagueAction, deleteLeagueAction } from '../../lib/actions/leagues';

interface LeagueAdminData {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  status: string;
  createdAt: string;
  owner: {
    name: string;
    email: string;
  };
  _count: {
    members: number;
  };
}

interface AdminLigasClientProps {
  leagues: LeagueAdminData[];
}

export const AdminLigasClient: React.FC<AdminLigasClientProps> = ({ leagues }) => {
  const router = useRouter();
  const [loadingLeagueId, setLoadingLeagueId] = useState<string | null>(null);

  const handleArchive = async (leagueId: string, currentStatus: string) => {
    const isArchived = currentStatus === 'archived';
    const actionLabel = isArchived ? 'reactivar' : 'archivar';
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} esta liga?`)) {
      return;
    }

    setLoadingLeagueId(leagueId);
    const res = await archiveLeagueAction(leagueId, !isArchived);
    setLoadingLeagueId(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleDelete = async (leagueId: string) => {
    if (!confirm('¡ADVERTENCIA CRÍTICA! Esto eliminará permanentemente la liga y todas sus predicciones y membresías. ¿Continuar?')) {
      return;
    }

    setLoadingLeagueId(leagueId);
    const res = await deleteLeagueAction(leagueId);
    setLoadingLeagueId(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back Link and Page Header */}
        <div className="space-y-4 pt-2">
          <Link href="/admin" className="text-xs text-text-secondary hover:text-gold-400 flex items-center gap-1.5 w-fit">
            <ArrowLeft className="w-4 h-4" /> Volver a administración
          </Link>

          <div className="flex items-center gap-3 pb-1 border-b border-border-subtle">
            <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-3xl tracking-wide text-text-primary">ADMINISTRAR LIGAS</h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Shield className="w-3.5 h-3.5 text-rank-up" />
                <span>Superadmin Dashboard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leagues List Table */}
        <div className="card-base overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold text-center">
            <span className="col-span-3 text-left">Liga</span>
            <span className="col-span-3 text-left">Creador</span>
            <span className="col-span-2">Miembros</span>
            <span className="col-span-2">Estado</span>
            <span className="col-span-2 text-right">Acciones</span>
          </div>

          <div className="divide-y divide-border-subtle">
            {leagues.length === 0 ? (
              <div className="p-8 text-center text-text-secondary">
                No hay ligas creadas en el sistema.
              </div>
            ) : (
              leagues.map((l) => {
                const isArchived = l.status === 'archived';
                const isLoading = loadingLeagueId === l.id;
                return (
                  <div
                    key={l.id}
                    className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-0 px-4 py-4 items-center"
                  >
                    {/* League Name */}
                    <div className="col-span-3 w-full text-left">
                      <p className="font-bold text-text-primary text-sm">{l.name}</p>
                      <span className="text-xs text-text-secondary font-mono">ID: {l.id} | Código: {l.inviteCode}</span>
                    </div>

                    {/* Owner Info */}
                    <div className="col-span-3 w-full text-left">
                      <p className="text-sm font-semibold text-text-secondary">{l.owner.name}</p>
                      <span className="text-xs text-text-muted font-mono">{l.owner.email}</span>
                    </div>

                    {/* Members Count */}
                    <div className="col-span-2 flex items-center justify-center gap-1 text-sm text-text-primary">
                      <Users className="w-4 h-4 text-gold-400" />
                      <span>{l._count.members}</span>
                    </div>

                    {/* Status badge */}
                    <div className="col-span-2 flex items-center justify-center">
                      <span
                        className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${
                          isArchived
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-green-500/10 text-green-400 border-green-500/30'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 w-full flex justify-end items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleArchive(l.id, l.status)}
                        disabled={isLoading}
                        title={isArchived ? 'Reactivar Liga' : 'Archivar Liga'}
                        className="p-1.5 bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-gold-400 border border-border-default rounded-lg transition-all"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(l.id)}
                        disabled={isLoading}
                        title="Eliminar Liga"
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
