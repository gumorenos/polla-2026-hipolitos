'use client';

import React from 'react';
import type { WorldCupQualification, QualificationStatus } from '../../lib/fifa-qualification';

interface FifaClassificationEngineProps {
  qualification: WorldCupQualification;
}

export const FifaClassificationEngine: React.FC<FifaClassificationEngineProps> = ({ qualification }) => {
  if (!qualification || qualification.groups.length === 0) {
    return (
      <div className="card-base p-6 text-center">
        <h3 className="font-display text-lg text-gold-400 tracking-wide uppercase">Clasificación FIFA 2026</h3>
        <p className="text-xs text-text-muted mt-1">Todavía no hay partidos de fase de grupos para calcular tablas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-border-subtle pb-2">
        <div>
          <h3 className="font-display text-xl text-gold-400 tracking-wide uppercase">Tablas de Posiciones (FIFA 2026)</h3>
          <p className="text-xs text-text-secondary">
            Cálculo oficial de grupos, mejores terceros y desempates en tiempo real.
          </p>
        </div>
        <div className="text-[10px] text-text-muted font-mono uppercase">
          {qualification.qualifiedTeamCodes.length} clasificados calculados
        </div>
      </div>

      {qualification.unresolvedTies && qualification.unresolvedTies.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
          <p className="font-bold uppercase tracking-wider text-[10px]">Nota de desempate:</p>
          <ul className="list-disc pl-4 space-y-1">
            {qualification.unresolvedTies.map((tie, idx) => (
              <li key={idx}>{tie}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {qualification.groups.map((group) => (
          <div key={group.group} className="card-base overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-secondary/60 border-b border-border-subtle">
              <span className="font-display text-base uppercase tracking-wide text-text-primary">Grupo {group.group}</span>
              <span className="text-[10px] font-mono text-text-muted">
                {group.playedMatches}/{group.totalMatches} partidos jugados
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="text-[9px] font-mono uppercase text-text-muted bg-black/10 border-b border-border-subtle/50">
                  <tr>
                    <th className="px-3 py-2 text-center w-8">Pos</th>
                    <th className="px-3 py-2">Equipo</th>
                    <th className="px-2 py-2 text-center w-8">PJ</th>
                    <th className="px-2 py-2 text-center w-8">PG</th>
                    <th className="px-2 py-2 text-center w-8">PE</th>
                    <th className="px-2 py-2 text-center w-8">PP</th>
                    <th className="px-2 py-2 text-center w-10">GF</th>
                    <th className="px-2 py-2 text-center w-10">GC</th>
                    <th className="px-2 py-2 text-center w-10">DG</th>
                    <th className="px-2 py-2 text-center w-12">Pts</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Desempate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {group.entries.map((entry) => (
                    <tr key={entry.teamCode} className={`hover:bg-bg-hover/30 transition-colors ${entry.status === 'eliminated' ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2 text-center font-mono font-bold text-text-muted">{entry.rank}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-text-primary">{entry.teamName}</span>
                        <span className="ml-1 text-[10px] text-text-muted font-mono uppercase">({entry.teamCode})</span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono">{entry.played}</td>
                      <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.wins}</td>
                      <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.draws}</td>
                      <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.losses}</td>
                      <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.goalsFor}</td>
                      <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.goalsAgainst}</td>
                      <td className={`px-2 py-2 text-center font-mono font-semibold ${entry.goalDifference > 0 ? 'text-green-400' : entry.goalDifference < 0 ? 'text-red-400' : 'text-text-muted'}`}>
                        {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-bold text-gold-400 bg-gold-400/5">{entry.points}</td>
                      <td className="px-3 py-2">
                        <QualificationBadge status={entry.status} unresolved={entry.unresolvedTiebreaker} />
                      </td>
                      <td className="px-3 py-2 text-[10px] text-text-muted max-w-[120px] truncate">
                        {entry.unresolvedTiebreaker 
                          ? entry.unresolvedReason || 'Pendiente' 
                          : entry.fairPlayScore !== null 
                            ? `FairPlay: ${entry.fairPlayScore}` 
                            : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="card-base overflow-hidden">
        <div className="px-4 py-3 bg-bg-secondary/60 border-b border-border-subtle flex justify-between items-center">
          <span className="font-display text-base uppercase tracking-wide text-text-primary">Tabla de mejores terceros</span>
          <span className="text-[10px] text-text-muted uppercase font-mono">Clasifican los mejores 8</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="text-[9px] font-mono uppercase text-text-muted bg-black/10 border-b border-border-subtle/50">
              <tr>
                <th className="px-3 py-2 text-center w-8">Pos</th>
                <th className="px-3 py-2">Equipo</th>
                <th className="px-2 py-2 text-center w-8">PJ</th>
                <th className="px-2 py-2 text-center w-8">PG</th>
                <th className="px-2 py-2 text-center w-8">PE</th>
                <th className="px-2 py-2 text-center w-8">PP</th>
                <th className="px-2 py-2 text-center w-10">GF</th>
                <th className="px-2 py-2 text-center w-10">GC</th>
                <th className="px-2 py-2 text-center w-10">DG</th>
                <th className="px-2 py-2 text-center w-12">Pts</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Desempate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/30">
              {qualification.thirdPlacedTeams.map((entry, index) => (
                <tr key={`${entry.group}-${entry.teamCode}`} className={`hover:bg-bg-hover/30 transition-colors ${index >= 8 ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 text-center font-mono font-bold text-text-muted">{index + 1}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-text-primary">{entry.teamName}</span>
                    <span className="ml-1 text-[10px] text-text-muted font-mono uppercase">({entry.teamCode})</span>
                    <span className="ml-1.5 text-[9px] bg-bg-secondary text-text-muted border border-border-subtle px-1 py-0.5 rounded font-mono uppercase">G: {entry.group}</span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono">{entry.played}</td>
                  <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.wins}</td>
                  <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.draws}</td>
                  <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.losses}</td>
                  <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.goalsFor}</td>
                  <td className="px-2 py-2 text-center font-mono text-text-muted">{entry.goalsAgainst}</td>
                  <td className={`px-2 py-2 text-center font-mono font-semibold ${entry.goalDifference > 0 ? 'text-green-400' : entry.goalDifference < 0 ? 'text-red-400' : 'text-text-muted'}`}>
                    {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-gold-400 bg-gold-400/5">{entry.points}</td>
                  <td className="px-3 py-2">
                    <QualificationBadge status={entry.status} unresolved={entry.unresolvedTiebreaker} />
                  </td>
                  <td className="px-3 py-2 text-[10px] text-text-muted max-w-[120px] truncate">
                    {entry.unresolvedTiebreaker 
                      ? entry.unresolvedReason || 'Pendiente' 
                      : entry.fairPlayScore !== null 
                        ? `FairPlay: ${entry.fairPlayScore}` 
                        : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function QualificationBadge({
  status,
  unresolved,
}: {
  status: QualificationStatus;
  unresolved?: boolean;
}) {
  if (unresolved && (status === 'pending' || status === 'third_place_pending')) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-mono uppercase text-amber-200 whitespace-nowrap">
        Desempate pendiente
      </span>
    );
  }

  const styles: Record<string, string> = {
    group_winner: 'border-green-500/30 bg-green-500/10 text-green-300',
    group_runner_up: 'border-green-500/30 bg-green-500/10 text-green-300',
    third_place_qualified: 'border-gold-400/40 bg-gold-400/10 text-gold-400',
    third_place_pending: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    eliminated: 'border-red-500/30 bg-red-500/10 text-red-300',
    pending: 'border-border-subtle bg-surface/50 text-text-muted',
  };
  const labels: Record<string, string> = {
    group_winner: '1ro clasifica',
    group_runner_up: '2do clasifica',
    third_place_qualified: '3ro clasifica',
    third_place_pending: '3ro pendiente',
    eliminated: 'Eliminado',
    pending: 'Pendiente',
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase whitespace-nowrap ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}
