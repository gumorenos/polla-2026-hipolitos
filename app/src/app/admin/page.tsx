'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { MOCK_MATCHES, MOCK_LEAGUES } from '../../lib/mockData';
import { FlagDisc } from '../../components/ui/FlagDisc';
import { Shield, Settings, Play, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'leagues' | 'users'>('matches');
  const [matches, setMatches] = useState(MOCK_MATCHES);

  const handleUpdateScore = (matchId: string, homeScore: number, awayScore: number) => {
    setMatches(
      matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              homeScore,
              awayScore,
              status: 'result' as const,
            }
          : m
      )
    );
  };

  const handleSetLive = (matchId: string) => {
    setMatches(
      matches.map((m) =>
        m.id === matchId
          ? {
              ...m,
              homeScore: 0,
              awayScore: 0,
              status: 'live' as const,
            }
          : m
      )
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
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

        {/* Sub Navigation */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('matches')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              activeSubTab === 'matches'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Partidos ({matches.length})
          </button>
          <Link
            href="/admin/ligas"
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary flex items-center"
          >
            Ligas
          </Link>
          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              activeSubTab === 'users'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Usuarios
          </button>
        </div>

        {/* 1. MATCHES TAB */}
        {activeSubTab === 'matches' && (
          <div className="space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Registrar Resultados</h3>
            <div className="grid grid-cols-1 gap-4">
              {matches.map((m) => {
                const isFinished = m.status === 'result';
                const isLive = m.status === 'live';
                return (
                  <div key={m.id} className="card-base p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Teams block */}
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FlagDisc code={m.homeTeamCode} size={28} />
                        <span className="font-semibold text-sm truncate">{m.homeTeamCode}</span>
                      </div>
                      <span className="text-text-muted font-bold">:</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse text-right">
                        <FlagDisc code={m.awayTeamCode} size={28} />
                        <span className="font-semibold text-sm truncate">{m.awayTeamCode}</span>
                      </div>
                    </div>

                    {/* Status capsule */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                        isFinished ? 'bg-bg-primary text-text-muted border-border-default' :
                        isLive ? 'bg-red-500/10 text-rank-down border-red-500/30' : 'bg-gold-400/10 text-gold-400 border-gold-400/30'
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    {/* Actions and inputs */}
                    <div className="flex items-center gap-3">
                      {!isFinished && !isLive && (
                        <button
                          type="button"
                          onClick={() => handleSetLive(m.id)}
                          className="btn-ghost py-1 px-3 text-xs flex items-center gap-1 hover:text-rank-down hover:border-rank-down/40"
                        >
                          <Play className="w-3.5 h-3.5" /> Iniciar
                        </button>
                      )}

                      {/* Manual score inputs */}
                      <div className="flex items-center gap-1 text-center font-mono">
                        <input
                          type="number"
                          min="0"
                          max="9"
                          placeholder="Home"
                          defaultValue={m.homeScore ?? ''}
                          id={`h-${m.id}`}
                          className="w-10 h-8 text-center bg-bg-secondary border border-border-default rounded text-sm text-text-primary focus:border-gold-400 outline-none"
                        />
                        <span className="text-text-muted text-xs">:</span>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          placeholder="Away"
                          defaultValue={m.awayScore ?? ''}
                          id={`a-${m.id}`}
                          className="w-10 h-8 text-center bg-bg-secondary border border-border-default rounded text-sm text-text-primary focus:border-gold-400 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const hVal = (document.getElementById(`h-${m.id}`) as HTMLInputElement)?.value;
                          const aVal = (document.getElementById(`a-${m.id}`) as HTMLInputElement)?.value;
                          if (hVal !== '' && aVal !== '') {
                            handleUpdateScore(m.id, parseInt(hVal), parseInt(aVal));
                          }
                        }}
                        className="btn-gold py-1.5 px-3.5 text-xs flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Guardar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. LEAGUES TAB */}
        {activeSubTab === 'leagues' && (
          <div className="space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Administrar Ligas</h3>
            <div className="grid grid-cols-1 gap-4">
              {MOCK_LEAGUES.map((l) => (
                <div key={l.id} className="card-base p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">{l.name}</h4>
                    <span className="text-xs text-text-secondary">Código de invitación: {l.inviteCode}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-text-muted">Pozo: ${l.pot} USD</span>
                    <span className="text-rank-up uppercase">ACTIVO</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. USERS TAB */}
        {activeSubTab === 'users' && (
          <div className="space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Gestión de Usuarios</h3>
            <div className="card-base overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold">
                <span>Usuario</span>
                <span>Rol</span>
              </div>
              <div className="divide-y divide-border-subtle">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Gustavo (Tú)</p>
                    <span className="text-xs text-text-secondary">gustavo@example.com</span>
                  </div>
                  <span className="text-xs bg-gold-400/10 text-gold-400 border border-gold-400/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 font-semibold">
                    SUPERADMIN
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Carlos Rodriguez</p>
                    <span className="text-xs text-text-secondary">carlos@example.com</span>
                  </div>
                  <button type="button" className="btn-ghost py-1 px-3 text-xs">
                    Hacer Admin
                  </button>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Mariana Gomez</p>
                    <span className="text-xs text-text-secondary">mariana@example.com</span>
                  </div>
                  <button type="button" className="btn-ghost py-1 px-3 text-xs">
                    Hacer Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
