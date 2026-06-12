'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { MOCK_LEAGUES } from '../../lib/mockData';
import { Users, DollarSign, Plus, ArrowRight, Clipboard } from 'lucide-react';
import Link from 'next/link';

export default function LigasPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [createdLeagues, setCreatedLeagues] = useState(MOCK_LEAGUES);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName) return;

    const newLeague = {
      id: `l-${createdLeagues.length + 1}`,
      name: newLeagueName,
      slug: newLeagueName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      pot: 0,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
    };

    setCreatedLeagues([...createdLeagues, newLeague]);
    setNewLeagueName('');
    setShowCreateModal(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="font-display text-3xl tracking-wide text-text-primary">MIS LIGAS</h2>
            <p className="text-text-secondary text-sm">Crea ligas privadas o únete a ligas de tus amigos.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-gold text-sm py-2 px-4 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Crear Liga
          </button>
        </div>

        {/* Leagues List and Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Leagues List (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {createdLeagues.map((league) => (
              <div key={league.id} className="card-base p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-text-primary">{league.name}</h3>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-gold-400" />
                      {league.id === 'l-1' ? 5 : 2} miembros
                    </span>
                    <span className="flex items-center gap-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-gold-400" />
                      Premio: ${league.pot} USD
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Share Invite Code */}
                  <div className="bg-bg-secondary border border-border-default px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <span className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">CÓDIGO:</span>
                    <span className="font-mono text-sm font-bold text-gold-400">{league.inviteCode}</span>
                    <button
                      type="button"
                      title="Copiar Código"
                      onClick={() => navigator.clipboard.writeText(league.inviteCode)}
                      className="text-text-muted hover:text-gold-400"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Link href={`/liga/${league.slug}`} className="btn-ghost flex items-center gap-1 text-sm py-1.5 px-3">
                    Ingresar <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Join League Form (Right 1 col) */}
          <div className="card-base p-5 space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Unirse a Liga</h3>
            <p className="text-xs text-text-secondary">
              Ingresa el código de invitación que te compartió el administrador de la liga.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Ej. HIPO2026"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="field font-mono tracking-widest text-center"
              />
              <Link
                href={`/join/${inviteCode || 'TEMP'}`}
                className={`w-full btn-gold py-2 px-4 text-center text-sm flex items-center justify-center gap-1 ${
                  !inviteCode ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Unirse a Liga
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 max-w-md w-full border-border-active space-y-4">
            <h3 className="font-display text-2xl tracking-wide text-text-primary">CREAR NUEVA LIGA</h3>
            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Nombre de la Liga
                </label>
                <input
                  type="text"
                  placeholder="Ej. Amigos del Fútbol"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="field"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-text-muted">
                Una vez creada, generaremos un código de invitación único. Podrás compartir este código para que otros se unan.
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-ghost py-2 px-4 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-gold py-2 px-4 text-xs"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
