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
}

function pickTypeLabel(pickType: string): string {
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
}: PublicMatchPoolsSectionProps) {
  if (pools.length === 0) {
    return (
      <section style={{ padding: '1.5rem 0', color: 'var(--text-muted, #888)' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          Retos por Partido
        </h2>
        <p style={{ fontSize: '0.9rem' }}>
          No hay retos activos por el momento.
        </p>
      </section>
    );
  }

  return (
    <section style={{ padding: '1rem 0' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 700 }}>
        Retos por Partido
        <span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--text-muted, #888)' }}>
          Bolsa entre amigos — monto referencial
        </span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {pools.map((pool) => (
          <div
            key={pool.id}
            style={{
              border: '1px solid var(--border, #333)',
              borderRadius: '8px',
              padding: '1rem',
              background: 'var(--card-bg, #1a1a1a)',
            }}
          >
            {/* Pool header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>
                {matchLabels[pool.matchId] ?? pool.matchId}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: pool.status === 'settled' ? '#1a4d1a' : pool.status === 'void' ? '#4d1a1a' : '#1a2d4d',
                  color: '#eee',
                }}
              >
                {poolStatusLabel(pool.status)}
              </span>
            </div>

            {/* Referential amount */}
            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-muted, #aaa)' }}>
              Monto referencial:{' '}
              <strong style={{ color: 'var(--text-primary, #fff)' }}>
                {pool.amount} {pool.currency}
              </strong>
              {pool.note && (
                <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>— {pool.note}</span>
              )}
            </div>

            {/* Creator */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '0.5rem' }}>
              Creado por: {pool.createdByDisplayName}
            </div>

            {/* Participants */}
            {pool.entries.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Participantes ({pool.entries.length})
                </div>
                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted, #888)' }}>
                      <th style={{ textAlign: 'left', padding: '0.2rem' }}>Jugador</th>
                      <th style={{ textAlign: 'left', padding: '0.2rem' }}>Predicción</th>
                      <th style={{ textAlign: 'left', padding: '0.2rem' }}>Estado</th>
                      {pool.status === 'settled' && (
                        <th style={{ textAlign: 'right', padding: '0.2rem' }}>Resultado ref.</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pool.entries.map((entry) => (
                      <tr key={entry.userId}>
                        <td style={{ padding: '0.2rem' }}>{entry.displayName}</td>
                        <td style={{ padding: '0.2rem' }}>{pickTypeLabel(entry.pickType)}</td>
                        <td style={{ padding: '0.2rem' }}>{entryStatusLabel(entry.status)}</td>
                        {pool.status === 'settled' && (
                          <td style={{ padding: '0.2rem', textAlign: 'right', color: (entry.netAmount ?? 0) >= 0 ? '#4caf50' : '#f44336' }}>
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

            {/* Invites */}
            {pool.invites.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)' }}>
                <span style={{ fontWeight: 600 }}>Invitados: </span>
                {pool.invites.map((inv, i) => (
                  <span key={inv.invitedUserId}>
                    {inv.invitedDisplayName} ({inviteStatusLabel(inv.status)})
                    {i < pool.invites.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Settlement result */}
            {pool.status === 'settled' && pool.settlementReason && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#4caf50', fontStyle: 'italic' }}>
                {pool.settlementReason}
                <br />
                <span style={{ color: 'var(--text-muted, #888)' }}>
                  Liquidación referencial — pendiente de coordinar fuera de la app.
                </span>
              </div>
            )}

            {pool.status === 'void' && pool.settlementReason && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f44336', fontStyle: 'italic' }}>
                {pool.settlementReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
