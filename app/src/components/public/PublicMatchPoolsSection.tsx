/**
 * app/src/components/public/PublicMatchPoolsSection.tsx
 *
 * Read-only public/guest display for "Retos por Partido" (Match Pool).
 * No authentication required. No admin controls.
 */

'use client';

import React from 'react';
import type { PublicMatchPool } from '../../lib/match-pool';

interface PublicMatchPoolsSectionProps {
  pools: PublicMatchPool[];
  matchLabels?: Record<string, string>; // matchId -> "Team A vs Team B"
  leagueLabels?: Record<string, string>;
  showHeading?: boolean;
}

function pickTypeLabel(
  pickType: string,
  pickValue: string,
  match?: {
    phase: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeTeamName: string;
    awayTeamName: string;
  } | null
): string {
  if (match) {
    const homeLabel = match.homeTeamName || match.homeTeamCode;
    const awayLabel = match.awayTeamName || match.awayTeamCode;
    if (match.phase === 'groups') {
      if (pickType === 'home_win') return `${homeLabel} gana`;
      if (pickType === 'away_win') return `${awayLabel} gana`;
      if (pickType === 'draw') return 'Empate';
    } else {
      if (pickType === 'home_advances') return `${homeLabel} avanza`;
      if (pickType === 'away_advances') return `${awayLabel} avanza`;
    }
  }

  switch (pickType) {
    case 'home_win':       return 'Victoria local';
    case 'draw':           return 'Empate';
    case 'away_win':       return 'Victoria visitante';
    case 'home_advances':  return 'Local avanza';
    case 'away_advances':  return 'Visitante avanza';
    default:               return pickType;
  }
}

function poolStatusLabel(status: string): string {
  switch (status) {
    case 'open':      return 'Abierto';
    case 'locked':    return 'Cerrado (partido en curso)';
    case 'settled':   return 'Liquidado';
    case 'void':      return 'Anulado';
    case 'cancelled': return 'Cancelado';
    default:          return status;
  }
}

function poolStatusClass(status: string): string {
  switch (status) {
    case 'open': return 'border-green-500/30 bg-green-500/10 text-green-300';
    case 'locked': return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'cancelled': return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'void':
    case 'settled':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
    default: return 'border-border-default bg-bg-secondary text-text-secondary';
  }
}

function entryStatusLabel(status: string): string {
  switch (status) {
    case 'active':    return 'Activo';
    case 'winner':    return '🏆 Ganador';
    case 'loser':     return 'Perdedor';
    case 'void':      return 'Anulado';
    case 'cancelled': return 'Cancelado';
    default:          return status;
  }
}

function inviteStatusLabel(status: string): string {
  switch (status) {
    case 'pending':   return 'Invitado (pendiente)';
    case 'accepted':  return 'Aceptó';
    case 'declined':  return 'Rechazó';
    case 'expired':   return 'Expirado';
    default:          return status;
  }
}

export function PublicMatchPoolsSection({
  pools,
  matchLabels = {},
  leagueLabels = {},
  showHeading = true,
}: PublicMatchPoolsSectionProps) {
  if (pools.length === 0) {
    return (
      <section className="py-5 text-text-muted">
        {showHeading && <h2 className="mb-2 font-display text-xl tracking-wide text-text-primary">Retos por Partido</h2>}
        <p className="text-sm">
          No hay retos activos por el momento.
        </p>
      </section>
    );
  }

  return (
    <section className="py-4">
      {showHeading && (
        <div className="mb-4">
          <h2 className="font-display text-xl tracking-wide text-text-primary">Retos por Partido</h2>
          <p className="text-xs text-cyan-300">Bolsa entre amigos por cada partido · monto referencial</p>
        </div>
      )}

      <div className="space-y-3">
        {pools.map((pool) => (
          <article key={pool.id} className="card-base border-l-2 border-l-cyan-400 p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                {leagueLabels[pool.leagueId] && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    {leagueLabels[pool.leagueId]}
                  </p>
                )}
                <p className="font-semibold text-text-primary">{matchLabels[pool.matchId] ?? pool.matchId}</p>
              </div>
              <span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase ${poolStatusClass(pool.status)}`}>
                {poolStatusLabel(pool.status)}
              </span>
            </div>

            <div className="mb-2 text-sm text-text-secondary">
              Monto referencial:{' '}
              <strong className="text-text-primary">
                {pool.amount} {pool.currency}
              </strong>
              {pool.note && (
                <span className="ml-2 italic text-text-muted">· {pool.note}</span>
              )}
            </div>

            <div className="mb-3 text-xs text-text-muted">
              Creado por: {pool.createdByDisplayName}
            </div>

            {pool.entries.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <p className="mb-1 text-xs font-semibold text-text-primary">Entradas en este reto ({pool.entries.length})</p>
                <table className="w-full min-w-[430px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="p-1 text-left">Jugador</th>
                      <th className="p-1 text-left">Predicción</th>
                      <th className="p-1 text-left">Estado</th>
                      {pool.status === 'settled' && (
                        <th className="p-1 text-right">Resultado ref.</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pool.entries.map((entry) => (
                      <tr key={entry.userId} className="border-b border-border-subtle/50 text-text-secondary last:border-0">
                        <td className="p-1">{entry.displayName}</td>
                        <td className="p-1">{pickTypeLabel(entry.pickType, entry.pickValue, pool.match)}</td>
                        <td className="p-1">{entryStatusLabel(entry.status)}</td>
                        {pool.status === 'settled' && (
                          <td className={`p-1 text-right ${(entry.netAmount ?? 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                            {entry.netAmount !== null ? (
                              `${entry.netAmount >= 0 ? '+' : ''}${entry.netAmount} ${pool.currency}`
                            ) : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pool.invites.length > 0 && (
              <div className="text-xs text-text-muted">
                <span className="font-semibold text-text-secondary">Invitados: </span>
                {pool.invites.map((inv, i) => (
                  <span key={inv.invitedUserId}>
                    {inv.invitedDisplayName} ({inviteStatusLabel(inv.status)})
                    {i < pool.invites.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}

            {pool.status === 'settled' && pool.settlementReason && (
              <div className="mt-2 rounded border border-zinc-500/20 bg-zinc-500/5 p-2 text-xs italic text-zinc-300">
                {pool.settlementReason}
                <br />
                <span className="text-text-muted">
                  Liquidación referencial — pendiente de coordinar fuera de la app.
                </span>
              </div>
            )}

            {(pool.status === 'void' || pool.status === 'cancelled') && pool.settlementReason && (
              <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 p-2 text-xs italic text-red-300">
                {pool.settlementReason}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
