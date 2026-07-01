'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelMatchPoolAction,
  createMatchPoolAction,
  inviteToMatchPoolAction,
  joinMatchPoolAction,
  updateMatchPoolAction,
  hideMatchPoolAction,
} from '../../lib/actions/match-pools';
import {
  getMatchPoolEntryDeadline,
  creatorCanMutate,
  adminMutationRequiresReason,
} from '../../lib/match-pool';
import type { MatchPoolPickType, PublicMatchPool } from '../../lib/match-pool';
import { PublicMatchPoolsSection } from '../public/PublicMatchPoolsSection';

interface MatchOption {
  id: string;
  label: string;
  phase: string;
  kickoffUtc: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeamName?: string;
  awayTeamName?: string;
  status: string;
  resultStatus: string | null;
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
    matchPoolLateEntryEnabled: boolean;
    matchPoolLateEntryMinutes: number;
  };
  pools: PublicMatchPool[];
  matches: MatchOption[];
  matchLabels: Record<string, string>;
  approvedUsers: ApprovedUserOption[];
  currentUserId: string;
  canManage: boolean;
  isSuperadmin: boolean;
  nowIso: string;
}

type MatchPoolActionResult = { error: string } | { data: unknown };

function isGroupPhase(phase: string): boolean {
  return phase === 'groups';
}

function optionsForMatch(match: MatchOption): Array<{ value: MatchPoolPickType; label: string; pickValue: string }> {
  const homeLabel = match.homeTeamName || match.homeTeamCode;
  const awayLabel = match.awayTeamName || match.awayTeamCode;
  if (isGroupPhase(match.phase)) {
    return [
      { value: 'home_win', label: `${homeLabel} gana`, pickValue: match.homeTeamCode },
      { value: 'draw', label: 'Empate', pickValue: 'draw' },
      { value: 'away_win', label: `${awayLabel} gana`, pickValue: match.awayTeamCode },
    ];
  }
  return [
    { value: 'home_advances', label: `${homeLabel} avanza`, pickValue: match.homeTeamCode },
    { value: 'away_advances', label: `${awayLabel} avanza`, pickValue: match.awayTeamCode },
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
  isSuperadmin,
  nowIso,
}: MatchPoolLeagueClientProps) {
  const nowMs = new Date(nowIso).getTime();
  const lateEntryConfig = {
    enabled: league.matchPoolLateEntryEnabled,
    minutes: league.matchPoolLateEntryMinutes,
  };
  const firstCreatableMatchId = matches.find((match) => (
    getMatchPoolEntryDeadline(match, lateEntryConfig).getTime() > nowMs
    && match.status !== 'result'
    && match.resultStatus !== 'final'
  ))?.id ?? '';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState(firstCreatableMatchId);
  const [selectedPick, setSelectedPick] = useState<MatchPoolPickType | ''>('');
  const [joinPicks, setJoinPicks] = useState<Record<string, MatchPoolPickType | ''>>({});
  const [inviteUsers, setInviteUsers] = useState<Record<string, string>>({});
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editMatchIds, setEditMatchIds] = useState<Record<string, string>>({});
  const [editPicks, setEditPicks] = useState<Record<string, MatchPoolPickType | ''>>({});
  const [adminReasons, setAdminReasons] = useState<Record<string, string>>({});

  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const creatableMatches = matches.filter((match) => (
    getMatchPoolEntryDeadline(match, lateEntryConfig).getTime() > nowMs
    && match.status !== 'result'
    && match.resultStatus !== 'final'
  ));
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

  function handleEdit(pool: PublicMatchPool, formData: FormData) {
    const matchId = editMatchIds[pool.id] ?? pool.matchId;
    const match = matchById.get(matchId);
    const creatorEntry = pool.entries.find((entry) => entry.userId === pool.createdByUserId);
    const pickType = editPicks[pool.id] || creatorEntry?.pickType || '';
    const option = match && pickType
      ? optionsForMatch(match).find((item) => item.value === pickType)
      : undefined;
    const amount = Number(formData.get('amount'));
    if (!match || !option || !Number.isInteger(amount) || amount <= 0) {
      setMessage('Revisa el partido, el monto referencial y la predicción.');
      return;
    }
    const entryUserIds = pool.entries.map((e) => e.userId);
    const requiresReason = adminMutationRequiresReason({
      status: pool.status,
      createdByUserId: pool.createdByUserId,
      currentUserId,
      entryUserIds,
      isSuperadmin,
    });
    const isCreator = pool.createdByUserId === currentUserId;
    const isOpen = pool.status === 'open';
    const hasOnlyCreatorEntry = pool.entries.length === 1 && pool.entries[0]?.userId === currentUserId;
    const isCreatorMutatingOwn = isCreator && isOpen && hasOnlyCreatorEntry;

    const reason = (requiresReason && !isCreatorMutatingOwn) ? (adminReasons[pool.id]?.trim() || undefined) : undefined;
    runAction(
      () => updateMatchPoolAction({
        poolId: pool.id,
        matchId,
        amount,
        currency: String(formData.get('currency') ?? pool.currency),
        note: String(formData.get('note') ?? '').trim() || undefined,
        pickType: option.value,
        pickValue: option.pickValue,
        reason,
      }),
      'Reto actualizado.',
    );
    setEditingPoolId(null);
  }

  function handleCancel(pool: PublicMatchPool) {
    const entryUserIds = pool.entries.map((e) => e.userId);
    const requiresReason = adminMutationRequiresReason({
      status: pool.status,
      createdByUserId: pool.createdByUserId,
      currentUserId,
      entryUserIds,
      isSuperadmin,
    });
    const isCreator = pool.createdByUserId === currentUserId;
    const isOpen = pool.status === 'open';
    const hasOnlyCreatorEntry = pool.entries.length === 1 && pool.entries[0]?.userId === currentUserId;
    const isCreatorMutatingOwn = isCreator && isOpen && hasOnlyCreatorEntry;

    const reason = (requiresReason && !isCreatorMutatingOwn) ? (adminReasons[pool.id]?.trim() || undefined) : undefined;
    runAction(
      () => cancelMatchPoolAction({
        poolId: pool.id,
        reason,
      }),
      'Reto cancelado.',
    );
  }

  function handleHide(pool: PublicMatchPool) {
    const reason = adminReasons[pool.id]?.trim() || undefined;
    runAction(
      () => hideMatchPoolAction({
        poolId: pool.id,
        reason,
      }),
      'Reto ocultado.',
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
        {creatableMatches.length === 0 ? (
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
                {creatableMatches.map((match) => <option key={match.id} value={match.id}>{match.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-text-secondary">
              Monto referencial ({league.currency})
              <input name="amount" type="number" min="1" step="1" required className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary" />
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
              Nota opcional
              <input name="note" maxLength={240} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary" />
            </label>
            <div className="md:col-span-2 rounded border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200">
              No se procesa dinero real. El monto es referencial y cualquier coordinación ocurre fuera de la app.
            </div>
            <button type="submit" disabled={isPending} className="w-fit rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-50">Crear reto</button>
          </form>
        )}
      </section>

      {message && <p role="status" className="rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary">{message}</p>}

      <section>
        <h2 className="text-xl font-semibold text-text-primary">Retos abiertos</h2>
        {openPools.map((pool) => {
          const match = matchById.get(pool.matchId);
          const alreadyJoined = pool.entries.some((entry) => entry.userId === currentUserId);
          const entryDeadline = match ? getMatchPoolEntryDeadline(match, lateEntryConfig) : null;
          const entryWindowOpen = entryDeadline ? entryDeadline.getTime() > nowMs : false;
          const isLateEntryWindow = match
            ? new Date(match.kickoffUtc).getTime() <= nowMs && entryWindowOpen
            : false;
          return (
            <div key={pool.id} className="mt-4 rounded border border-cyan-500/20 bg-surface p-4">
              <PublicMatchPoolsSection pools={[pool]} matchLabels={matchLabels} showHeading={false} />
              {match && pool.status === 'open' && (
                <p className={`mt-2 text-xs ${isLateEntryWindow || !entryWindowOpen ? 'text-amber-300' : 'text-green-300'}`}>
                  {entryWindowOpen
                    ? `${isLateEntryWindow ? 'Entrada tardía' : 'Abierto'} hasta ${entryDeadline?.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })} (Hora Lima)`
                    : 'El plazo de entrada ya cerró.'}
                </p>
              )}
              {!alreadyJoined && match && pool.status === 'open' && entryWindowOpen && (
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
              {(alreadyJoined || pool.createdByUserId === currentUserId || canManage) && approvedUsers.length > 0 && pool.status === 'open' && entryWindowOpen && (
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
              {(() => {
                const entryUserIds = pool.entries.map((e) => e.userId);
                const isCreatorCanMutate = creatorCanMutate({
                  status: pool.status,
                  createdByUserId: pool.createdByUserId,
                  currentUserId,
                  entryUserIds,
                });
                const requiresReason = adminMutationRequiresReason({
                  status: pool.status,
                  createdByUserId: pool.createdByUserId,
                  currentUserId,
                  entryUserIds,
                  isSuperadmin,
                });
                const canMutate = isCreatorCanMutate || isSuperadmin;
                if (!canMutate) return null;
                const creatorEntry = pool.entries.find((entry) => entry.userId === pool.createdByUserId);
                const editMatchId = editMatchIds[pool.id] ?? pool.matchId;
                const editMatch = matchById.get(editMatchId);
                const editPick = editPicks[pool.id] || creatorEntry?.pickType || '';
                const editOptions = matches.filter((candidate) => (
                  isSuperadmin
                  || candidate.id === pool.matchId
                  || new Date(candidate.kickoffUtc).getTime() > nowMs
                ));
                return (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setEditingPoolId(editingPoolId === pool.id ? null : pool.id)} className="rounded border border-cyan-500/30 px-3 py-1.5 text-sm text-cyan-200">
                        {editingPoolId === pool.id ? 'Cerrar edición' : 'Editar reto'}
                      </button>
                      <button type="button" disabled={isPending || (requiresReason && !adminReasons[pool.id]?.trim())} onClick={() => handleCancel(pool)} className="rounded border border-red-500/30 px-3 py-1.5 text-sm text-red-300 disabled:opacity-50">
                        Cancelar reto
                      </button>
                    </div>
                    {requiresReason && (
                      <label className="mt-3 block text-xs text-text-secondary">
                        Razón administrativa obligatoria
                        <input value={adminReasons[pool.id] ?? ''} onChange={(event) => setAdminReasons((current) => ({ ...current, [pool.id]: event.target.value }))} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary" />
                      </label>
                    )}
                    {editingPoolId === pool.id && creatorEntry && (
                      <form action={(formData) => handleEdit(pool, formData)} className="mt-3 grid gap-3 rounded border border-border bg-bg-secondary/30 p-3 md:grid-cols-2">
                        <label className="text-xs text-text-secondary">Partido
                          <select value={editMatchId} onChange={(event) => { setEditMatchIds((current) => ({ ...current, [pool.id]: event.target.value })); setEditPicks((current) => ({ ...current, [pool.id]: '' })); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary">
                            {editOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-text-secondary">Monto referencial
                          <input name="amount" type="number" min="1" step="1" defaultValue={pool.amount} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary" />
                        </label>
                        <label className="text-xs text-text-secondary">Predicción
                          <select value={editPick} onChange={(event) => setEditPicks((current) => ({ ...current, [pool.id]: event.target.value as MatchPoolPickType }))} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary">
                            {editMatch && optionsForMatch(editMatch).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-text-secondary">Moneda
                          <input name="currency" maxLength={3} defaultValue={pool.currency} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 uppercase text-text-primary" />
                        </label>
                        <label className="text-xs text-text-secondary md:col-span-2">Nota
                          <input name="note" maxLength={240} defaultValue={pool.note ?? ''} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary" />
                        </label>
                        <button type="submit" disabled={isPending || (requiresReason && !adminReasons[pool.id]?.trim())} className="w-fit rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar cambios</button>
                      </form>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
        {openPools.length === 0 && <p className="mt-2 text-sm text-text-muted">No hay retos abiertos.</p>}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-text-primary">Retos cerrados, liquidados o anulados</h2>
        {isSuperadmin ? (
          closedPools.map((pool) => {
            const entryUserIds = pool.entries.map((e) => e.userId);
            const isCreatorCanMutate = creatorCanMutate({
              status: pool.status,
              createdByUserId: pool.createdByUserId,
              currentUserId,
              entryUserIds,
            });
            const requiresReason = adminMutationRequiresReason({
              status: pool.status,
              createdByUserId: pool.createdByUserId,
              currentUserId,
              entryUserIds,
              isSuperadmin,
            });
            const canMutate = isCreatorCanMutate || isSuperadmin;
            const creatorEntry = pool.entries.find((entry) => entry.userId === pool.createdByUserId);
            const editMatchId = editMatchIds[pool.id] ?? pool.matchId;
            const editMatch = matchById.get(editMatchId);
            const editPick = editPicks[pool.id] || creatorEntry?.pickType || '';
            const editOptions = matches;

            const canHide = pool.status === 'cancelled' && pool.entries.length <= 1 && !pool.hiddenAt;

            return (
              <div key={pool.id} className="mt-4 rounded border border-cyan-500/20 bg-surface p-4">
                <PublicMatchPoolsSection pools={[pool]} matchLabels={matchLabels} showHeading={false} />
                
                {pool.hiddenAt && (
                  <p className="mt-2 text-xs text-amber-300">
                    Este reto está OCULTO para usuarios normales.
                  </p>
                )}

                {canMutate && pool.status !== 'settled' && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setEditingPoolId(editingPoolId === pool.id ? null : pool.id)} className="rounded border border-cyan-500/30 px-3 py-1.5 text-sm text-cyan-200">
                        {editingPoolId === pool.id ? 'Cerrar edición' : 'Editar reto'}
                      </button>
                      {pool.status !== 'cancelled' && (
                        <button type="button" disabled={isPending || (requiresReason && !adminReasons[pool.id]?.trim())} onClick={() => handleCancel(pool)} className="rounded border border-red-500/30 px-3 py-1.5 text-sm text-red-300 disabled:opacity-50">
                          Cancelar reto
                        </button>
                      )}
                      {canHide && (
                        <button type="button" disabled={isPending} onClick={() => handleHide(pool)} className="rounded border border-amber-500/30 px-3 py-1.5 text-sm text-amber-300 disabled:opacity-50">
                          Ocultar reto
                        </button>
                      )}
                    </div>
                    
                    {requiresReason && (
                      <label className="mt-3 block text-xs text-text-secondary">
                        Razón administrativa obligatoria
                        <input value={adminReasons[pool.id] ?? ''} onChange={(event) => setAdminReasons((current) => ({ ...current, [pool.id]: event.target.value }))} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-text-primary" />
                      </label>
                    )}

                    {editingPoolId === pool.id && creatorEntry && (
                      <form action={(formData) => handleEdit(pool, formData)} className="mt-3 grid gap-3 rounded border border-border bg-bg-secondary/30 p-3 md:grid-cols-2">
                        <label className="text-xs text-text-secondary">Partido
                          <select value={editMatchId} onChange={(event) => { setEditMatchIds((current) => ({ ...current, [pool.id]: event.target.value })); setEditPicks((current) => ({ ...current, [pool.id]: '' })); }} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary">
                            {editOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-text-secondary">Monto referencial
                          <input name="amount" type="number" min="1" step="1" defaultValue={pool.amount} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary" />
                        </label>
                        <label className="text-xs text-text-secondary">Predicción
                          <select value={editPick} onChange={(event) => setEditPicks((current) => ({ ...current, [pool.id]: event.target.value as MatchPoolPickType }))} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary">
                            {editMatch && optionsForMatch(editMatch).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-text-secondary">Moneda
                          <input name="currency" maxLength={3} defaultValue={pool.currency} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 uppercase text-text-primary" />
                        </label>
                        <label className="text-xs text-text-secondary md:col-span-2">Nota
                          <input name="note" maxLength={240} defaultValue={pool.note ?? ''} className="mt-1 w-full rounded border border-border bg-background px-2 py-2 text-text-primary" />
                        </label>
                        <button type="submit" disabled={isPending || (requiresReason && !adminReasons[pool.id]?.trim())} className="w-fit rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Guardar cambios</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <PublicMatchPoolsSection pools={closedPools} matchLabels={matchLabels} showHeading={false} />
        )}
      </section>
    </main>
  );
}
