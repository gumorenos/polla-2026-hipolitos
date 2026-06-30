'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMatchPoolAction,
  inviteToMatchPoolAction,
  joinMatchPoolAction,
} from '../../lib/actions/match-pools';
import type { MatchPoolPickType, PublicMatchPool } from '../../lib/match-pool';
import { PublicMatchPoolsSection } from '../public/PublicMatchPoolsSection';

interface MatchOption {
  id: string;
  label: string;
  phase: string;
  kickoffUtc: string;
  homeTeamCode: string;
  awayTeamCode: string;
}

interface ApprovedUserOption {
  id: string;
  displayName: string;
}

interface MatchPoolLeagueClientProps {
  league: {
    id: string;
    name: string;
    slug: string;
    currency: string;
  };
  pools: PublicMatchPool[];
  matches: MatchOption[];
  matchLabels: Record<string, string>;
  approvedUsers: ApprovedUserOption[];
  currentUserId: string;
  canManage: boolean;
}

type MatchPoolActionResult = { error: string } | { data: unknown };

function isGroupPhase(phase: string): boolean {
  return phase === 'groups';
}

function optionsForMatch(match: MatchOption): Array<{ value: MatchPoolPickType; label: string; pickValue: string }> {
  if (isGroupPhase(match.phase)) {
    return [
      { value: 'home_win', label: `${match.homeTeamCode} gana`, pickValue: match.homeTeamCode },
      { value: 'draw', label: 'Empate', pickValue: 'draw' },
      { value: 'away_win', label: `${match.awayTeamCode} gana`, pickValue: match.awayTeamCode },
    ];
  }
  return [
    { value: 'home_advances', label: `${match.homeTeamCode} avanza`, pickValue: match.homeTeamCode },
    { value: 'away_advances', label: `${match.awayTeamCode} avanza`, pickValue: match.awayTeamCode },
  ];
}

export function MatchPoolLeagueClient({
  league,
  pools,
  matches,
  matchLabels,
  approvedUsers,
  currentUserId,
  canManage,
}: MatchPoolLeagueClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id ?? '');
  const [selectedPick, setSelectedPick] = useState<MatchPoolPickType | ''>('');
  const [joinPicks, setJoinPicks] = useState<Record<string, MatchPoolPickType | ''>>({});
  const [inviteUsers, setInviteUsers] = useState<Record<string, string>>({});

  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const openPools = pools.filter((pool) => pool.status === 'open' || pool.status === 'locked');
  const closedPools = pools.filter((pool) => pool.status !== 'open' && pool.status !== 'locked');
  const selectedMatch = matchById.get(selectedMatchId);

  function runAction(action: () => Promise<MatchPoolActionResult>, successMessage: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if ('error' in result) {
        setMessage(result.error);
        return;
      }
      setMessage(successMessage);
      router.refresh();
    });
  }

  function handleCreate(formData: FormData) {
    if (!selectedMatch || !selectedPick) {
      setMessage('Selecciona un partido y una predicción.');
      return;
    }
    const option = optionsForMatch(selectedMatch).find((item) => item.value === selectedPick);
    const amount = Number(formData.get('amount'));
    if (!option || !Number.isInteger(amount) || amount <= 0) {
      setMessage('Ingresa un monto referencial entero y una predicción válida.');
      return;
    }
    runAction(
      () => createMatchPoolAction({
        leagueId: league.id,
        matchId: selectedMatch.id,
        amount,
        currency: league.currency,
        note: String(formData.get('note') ?? '').trim() || undefined,
        pickType: option.value,
        pickValue: option.pickValue,
      }),
      'Reto creado.',
    );
  }

  function handleJoin(pool: PublicMatchPool) {
    const match = matchById.get(pool.matchId);
    const pickType = joinPicks[pool.id];
    const option = match && pickType
      ? optionsForMatch(match).find((item) => item.value === pickType)
      : undefined;
    if (!option) {
      setMessage('Selecciona una predicción para unirte.');
      return;
    }
    runAction(
      () => joinMatchPoolAction({ poolId: pool.id, pickType: option.value, pickValue: option.pickValue }),
      'Te uniste al reto.',
    );
  }

  function handleInvite(poolId: string) {
    const invitedUserId = inviteUsers[poolId];
    if (!invitedUserId) {
      setMessage('Selecciona un usuario aprobado para invitar.');
      return;
    }
    runAction(
      () => inviteToMatchPoolAction({ poolId, invitedUserId }),
      'Invitación enviada.',
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">{league.name}</h1>
          <span className="rounded border border-accent/40 bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
            Retos por Partido
          </span>
        </div>
        <p className="mt-2 font-medium text-text-secondary">Bolsa entre amigos por cada partido</p>
        <p className="mt-2 max-w-3xl text-sm text-text-muted">
          No hay miembros fijos. Cada usuario aprobado puede entrar voluntariamente a los retos de cada partido.
          Los montos son referenciales y se coordinan fuera de la app.
        </p>
        {canManage && (
          <p className="mt-2 text-xs text-text-muted">Puedes administrar este contenedor sin figurar como participante.</p>
        )}
      </header>

      <section className="rounded border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-text-primary">Crear reto por partido</h2>
        {matches.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No hay partidos futuros disponibles.</p>
        ) : (
          <form action={handleCreate} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-text-secondary">
              Partido
              <select
                value={selectedMatchId}
                onChange={(event) => {
                  setSelectedMatchId(event.target.value);
                  setSelectedPick('');
                }}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary"
              >
                {matches.map((match) => <option key={match.id} value={match.id}>{match.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-text-secondary">
              Predicción
              <select
                value={selectedPick}
                onChange={(event) => setSelectedPick(event.target.value as MatchPoolPickType | '')}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary"
              >
                <option value="">Selecciona</option>
                {selectedMatch && optionsForMatch(selectedMatch).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-text-secondary">
              Monto referencial ({league.currency})
              <input name="amount" type="number" min="1" step="1" required className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary" />
            </label>
            <label className="text-sm text-text-secondary">
              Nota opcional
              <input name="note" maxLength={240} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary" />
            </label>
            <button type="submit" disabled={isPending} className="w-fit rounded bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
              Crear reto
            </button>
          </form>
        )}
      </section>

      {message && <p role="status" className="rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary">{message}</p>}

      <section>
        <h2 className="text-xl font-semibold text-text-primary">Retos abiertos</h2>
        {openPools.map((pool) => {
          const match = matchById.get(pool.matchId);
          const alreadyJoined = pool.entries.some((entry) => entry.userId === currentUserId);
          return (
            <div key={pool.id} className="mt-4 rounded border border-border bg-surface p-4">
              <PublicMatchPoolsSection pools={[pool]} matchLabels={matchLabels} />
              {!alreadyJoined && match && pool.status === 'open' && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <label className="text-sm text-text-secondary">
                    Tu predicción
                    <select
                      value={joinPicks[pool.id] ?? ''}
                      onChange={(event) => setJoinPicks((current) => ({ ...current, [pool.id]: event.target.value as MatchPoolPickType | '' }))}
                      className="ml-2 rounded border border-border bg-background px-2 py-1 text-text-primary"
                    >
                      <option value="">Selecciona</option>
                      {optionsForMatch(match).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={isPending} onClick={() => handleJoin(pool)} className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-50">
                    Entrar al reto
                  </button>
                </div>
              )}
              {(alreadyJoined || pool.createdByUserId === currentUserId || canManage) && approvedUsers.length > 0 && pool.status === 'open' && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <label className="text-sm text-text-secondary">
                    Invitar usuario aprobado
                    <select
                      value={inviteUsers[pool.id] ?? ''}
                      onChange={(event) => setInviteUsers((current) => ({ ...current, [pool.id]: event.target.value }))}
                      className="ml-2 rounded border border-border bg-background px-2 py-1 text-text-primary"
                    >
                      <option value="">Selecciona</option>
                      {approvedUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={isPending} onClick={() => handleInvite(pool.id)} className="rounded border border-border px-3 py-1.5 text-sm text-text-primary disabled:opacity-50">
                    Invitar
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {openPools.length === 0 && <p className="mt-2 text-sm text-text-muted">No hay retos abiertos.</p>}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-text-primary">Retos cerrados, liquidados o anulados</h2>
        <PublicMatchPoolsSection pools={closedPools} matchLabels={matchLabels} />
      </section>
    </main>
  );
}
