'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle,
  Crown,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { formatLeagueCurrency } from '../../../lib/utils/currency';
import {
  adminChangeChampionPick,
  adminCreateChampionOddsSnapshot,
  adminExportChampionSurvivorCsv,
  adminResetChampionPick,
  adminSetTeamTournamentStatus,
} from '../../../lib/actions/champion-survivor';
import type { TeamTournamentStatusValue } from '../../../lib/champion-survivor';

type ActionResponse = { success: true; data: unknown } | { error: string };

export interface ChampionSurvivorLeagueOption {
  id: string;
  name: string;
  slug: string;
  championDeadline: string | null;
  currency: string;
}

export interface ChampionSurvivorPickRow {
  userId: string;
  user: {
    id: string;
    name: string;
    displayName: string | null;
    username: string | null;
    email: string;
  };
  team: { code: string; name: string; hue: number } | null;
  teamCode: string | null;
  status: 'pending' | 'alive' | 'eliminated' | 'winner';
  teamTournamentStatus: TeamTournamentStatusValue;
  eliminatedAt: string | null;
  submittedAt: string | null;
  lockedAt: string | null;
  championProbability: number | null;
  championProbabilityAvailable: boolean;
  expectedValue: number | null;
  correctedAt: string | null;
  correctedByAdminId: string | null;
  lastCorrectionReason: string | null;
  previousTeamCode: string | null;
  newTeamCode: string | null;
}

export interface ChampionSurvivorLeagueData {
  league: ChampionSurvivorLeagueOption;
  error: string | null;
  teams: Array<{
    team: { code: string; name: string };
    status: string;
    eliminatedAt: string | null;
    eliminatedInMatchId: string | null;
    finalRank: number | null;
    notes: string | null;
    updatedAt: string | null;
    qualificationSuggestion: string;
  }>;
  odds: Array<{
    team: { code: string; name: string };
    latestSnapshot: {
      id: string;
      teamCode: string;
      provider: string;
      bookmaker: string;
      decimalOdds: number;
      impliedProbability: number;
      capturedAt: string;
    } | null;
  }>;
  picks: ChampionSurvivorPickRow[];
  summary: {
    totalParticipants: number;
    alive: number;
    eliminated: number;
    pending: number;
    winners: number;
    prizePool: { amount: number; estimated: boolean; currency: string };
    combinedAliveProbability: number | null;
    combinedAliveProbabilityAvailable: boolean;
  } | null;
  distribution: {
    byTeam: Array<{
      teamCode: string;
      count: number;
      percentage: number;
      status: string;
    }>;
    mostPickedTeam: {
      teamCode: string;
      count: number;
      percentage: number;
      status: string;
    } | null;
    exclusivePicks: Array<{
      teamCode: string;
      count: number;
      percentage: number;
      status: string;
    }>;
  };
  simulation: {
    available: boolean;
    resolved: boolean;
    iterations: number;
    message: string | null;
    lastCapturedAt: string | null;
    entries: Array<{
      teamCode: string;
      teamName: string | null;
      decimalOdds: number | null;
      rawImpliedProbability: number | null;
      normalizedProbability: number;
      simulatedWins: number;
      simulatedProbability: number;
      status: string;
      provider: string | null;
      bookmaker: string | null;
      capturedAt: string | null;
    }>;
  } | null;
  prizePool: { amount: number; estimated: boolean; currency: string } | null;
}

interface AdminChampionSurvivorClientProps {
  leagues: ChampionSurvivorLeagueOption[];
  leagueData: ChampionSurvivorLeagueData[];
  allTeams: Array<{ code: string; name: string }>;
}

const statusOptions: Array<{ value: TeamTournamentStatusValue; label: string; requiresReason: boolean }> = [
  { value: 'active', label: 'Marcar activo', requiresReason: false },
  { value: 'eliminated', label: 'Marcar eliminado', requiresReason: true },
  { value: 'runner_up', label: 'Marcar subcampeón', requiresReason: true },
  { value: 'champion', label: 'Marcar campeón', requiresReason: true },
];

export const AdminChampionSurvivorClient: React.FC<AdminChampionSurvivorClientProps> = ({
  leagues,
  leagueData,
  allTeams,
}) => {
  const router = useRouter();
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagues[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<'all' | ChampionSurvivorPickRow['status']>('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changeModal, setChangeModal] = useState<ChampionSurvivorPickRow | null>(null);
  const [resetModal, setResetModal] = useState<ChampionSurvivorPickRow | null>(null);
  const [statusModal, setStatusModal] = useState<{
    teamCode: string;
    teamName: string;
    status: TeamTournamentStatusValue;
  } | null>(null);
  const [changeTeamCode, setChangeTeamCode] = useState('');
  const [reason, setReason] = useState('');
  const [eliminatedInMatchId, setEliminatedInMatchId] = useState('');

  const activeData = useMemo(
    () => leagueData.find((item) => item.league.id === selectedLeagueId) || null,
    [leagueData, selectedLeagueId]
  );

  const filteredPicks = useMemo(() => {
    if (!activeData) return [];
    if (statusFilter === 'all') return activeData.picks;
    return activeData.picks.filter((pick) => pick.status === statusFilter);
  }, [activeData, statusFilter]);

  const exclusivePickRows = useMemo(() => {
    if (!activeData) return [];
    const counts = new Map<string, number>();
    for (const pick of activeData.picks) {
      if (!pick.teamCode) continue;
      counts.set(pick.teamCode, (counts.get(pick.teamCode) || 0) + 1);
    }
    return activeData.picks.filter((pick) => pick.teamCode && counts.get(pick.teamCode) === 1);
  }, [activeData]);

  const openChangeModal = (pick: ChampionSurvivorPickRow) => {
    setChangeModal(pick);
    setChangeTeamCode(pick.teamCode || '');
    setReason('');
    setMessage(null);
  };

  const openResetModal = (pick: ChampionSurvivorPickRow) => {
    setResetModal(pick);
    setReason('');
    setMessage(null);
  };

  const openStatusModal = (teamCode: string, teamName: string, status: TeamTournamentStatusValue) => {
    setStatusModal({ teamCode, teamName, status });
    setReason('');
    setEliminatedInMatchId('');
    setMessage(null);
  };

  const handleChangePick = async () => {
    if (!activeData || !changeModal) return;
    if (!changeTeamCode) {
      setMessage({ type: 'error', text: 'Selecciona una selección.' });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'El motivo es obligatorio.' });
      return;
    }
    if (!confirm('¿Confirmas el cambio de pick de campeón?')) return;

    await runAction(
      adminChangeChampionPick(activeData.league.id, changeModal.userId, changeTeamCode, reason),
      'Pick actualizado correctamente.'
    );
    setChangeModal(null);
  };

  const handleResetPick = async () => {
    if (!activeData || !resetModal) return;
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'El motivo es obligatorio.' });
      return;
    }
    if (!confirm('¿Confirmas el reset del pick de campeón?')) return;

    await runAction(
      adminResetChampionPick(activeData.league.id, resetModal.userId, reason),
      'Pick restablecido correctamente.'
    );
    setResetModal(null);
  };

  const handleSetTeamStatus = async () => {
    if (!activeData || !statusModal) return;
    const config = statusOptions.find((item) => item.value === statusModal.status);
    if (config?.requiresReason && !reason.trim()) {
      setMessage({ type: 'error', text: 'El motivo o notas son obligatorios para este estado.' });
      return;
    }
    if (!confirm(`¿Confirmas cambiar ${statusModal.teamName} a estado ${statusModal.status}?`)) return;

    await runAction(
      adminSetTeamTournamentStatus(
        activeData.league.id,
        statusModal.teamCode,
        statusModal.status,
        reason,
        { eliminatedInMatchId: eliminatedInMatchId.trim() || null }
      ),
      'Estado de selección actualizado.'
    );
    setStatusModal(null);
  };

  const handleOddsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeData) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const teamCode = String(formData.get('teamCode') || '');
    const decimalOdds = Number(formData.get('decimalOdds'));
    const provider = String(formData.get('provider') || '').trim();
    const bookmaker = String(formData.get('bookmaker') || '').trim();

    if (!teamCode) {
      setMessage({ type: 'error', text: 'Selecciona una selección.' });
      return;
    }
    if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
      setMessage({ type: 'error', text: 'La cuota decimal debe ser mayor a 1.' });
      return;
    }

    await runAction(
      adminCreateChampionOddsSnapshot(activeData.league.id, teamCode, decimalOdds, {
        provider: provider || 'manual',
        bookmaker: bookmaker || 'admin',
      }),
      'Cuota de campeón registrada.'
    );
    form.reset();
  };

  const handleCsvExport = async () => {
    if (!activeData) return;
    setLoading(true);
    setMessage(null);
    const result = (await adminExportChampionSurvivorCsv(activeData.league.id)) as ActionResponse;
    setLoading(false);

    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return;
    }

    const data = result.data as { csv: string; filename: string; contentType: string };
    const blob = new Blob([data.csv], { type: data.contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.filename || `champion-survivor-${activeData.league.slug}-picks.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'CSV generado correctamente.' });
  };

  const runAction = async (promise: Promise<ActionResponse>, successText: string) => {
    setLoading(true);
    setMessage(null);
    const result = await promise;
    setLoading(false);

    if ('error' in result) {
      setMessage({ type: 'error', text: result.error });
      return;
    }

    setMessage({ type: 'success', text: successText });
    router.refresh();
  };

  if (leagues.length === 0) {
    return (
      <div className="card-base p-8 text-center space-y-3">
        <Crown className="w-10 h-10 text-text-muted mx-auto" />
        <h3 className="font-display text-2xl text-text-primary tracking-wide">NO HAY COMPETENCIAS SOLO CAMPEÓN TODAVÍA.</h3>
        <p className="text-sm text-text-secondary">
          Crea o configura una competencia Champion Survivor desde los flujos de administración existentes.
        </p>
        <Link
          href="/competencia?tipo=champion_survivor"
          className="btn-gold px-4 py-2 text-xs font-mono uppercase tracking-wider inline-flex items-center justify-center"
        >
          Crear competencia Solo campeón
        </Link>
      </div>
    );
  }

  if (!activeData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="card-base p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
            Competencia Solo campeón
          </label>
          <select
            value={selectedLeagueId}
            onChange={(event) => setSelectedLeagueId(event.target.value)}
            className="field text-xs py-2 min-w-[260px]"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleCsvExport}
          disabled={loading}
          className="btn-gold px-4 py-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-400/10 border-green-500/20 text-green-400'
              : 'bg-red-400/10 border-red-500/20 text-red-400'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {activeData.error ? (
        <div className="card-base p-5 border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {activeData.error}
        </div>
      ) : (
        <>
          <SummaryCards data={activeData} />
          <SimulationPanel data={activeData} />
          <PicksTable
            data={activeData}
            picks={filteredPicks}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onChange={openChangeModal}
            onReset={openResetModal}
          />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TeamStatusPanel data={activeData} onSetStatus={openStatusModal} />
            <OddsPanel data={activeData} onSubmit={handleOddsSubmit} loading={loading} />
          </div>
          <DistributionPanel data={activeData} exclusivePickRows={exclusivePickRows} />
        </>
      )}

      {changeModal && (
        <ActionModal
          title="Cambiar pick de campeón"
          description={`${displayUser(changeModal)}: ${changeModal.team?.name || 'Sin selección'}`}
          confirmLabel="Guardar cambio"
          onClose={() => setChangeModal(null)}
          onConfirm={handleChangePick}
          loading={loading}
        >
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
              Nueva selección
            </label>
            <select
              value={changeTeamCode}
              onChange={(event) => setChangeTeamCode(event.target.value)}
              className="field text-xs py-2 w-full"
            >
              <option value="">-- Selecciona selección --</option>
              {allTeams.map((team) => (
                <option key={team.code} value={team.code}>
                  {team.name} ({team.code})
                </option>
              ))}
            </select>
          </div>
          <ReasonField value={reason} setValue={setReason} />
        </ActionModal>
      )}

      {resetModal && (
        <ActionModal
          title="Resetear pick de campeón"
          description={`${displayUser(resetModal)} quedará sin selección activa.`}
          confirmLabel="Resetear"
          onClose={() => setResetModal(null)}
          onConfirm={handleResetPick}
          loading={loading}
        >
          <ReasonField value={reason} setValue={setReason} />
        </ActionModal>
      )}

      {statusModal && (
        <ActionModal
          title="Actualizar estado de selección"
          description={`${statusModal.teamName} pasará a ${statusLabel(statusModal.status)}.`}
          confirmLabel="Actualizar"
          onClose={() => setStatusModal(null)}
          onConfirm={handleSetTeamStatus}
          loading={loading}
        >
          {statusModal.status === 'eliminated' && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                Match ID de eliminación (opcional)
              </label>
              <input
                value={eliminatedInMatchId}
                onChange={(event) => setEliminatedInMatchId(event.target.value)}
                className="field text-xs py-2 w-full"
                placeholder="matchId opcional"
              />
            </div>
          )}
          <ReasonField
            value={reason}
            setValue={setReason}
            label={statusModal.status === 'active' ? 'Notas opcionales' : 'Motivo o notas obligatorias'}
          />
        </ActionModal>
      )}
    </div>
  );
};

function SummaryCards({ data }: { data: ChampionSurvivorLeagueData }) {
  const summary = data.summary;
  const prizePool = data.prizePool || summary?.prizePool;
  const prizeLabel = prizePool?.estimated ? 'Pozo estimado' : 'Pozo fijo';

  const cards = [
    { label: 'Total participantes', value: summary?.totalParticipants ?? 0 },
    { label: 'Vivos', value: summary?.alive ?? 0 },
    { label: 'Eliminados', value: summary?.eliminated ?? 0 },
    { label: 'Sin selección', value: summary?.pending ?? 0 },
    { label: 'Ganadores', value: summary?.winners ?? 0 },
    {
      label: prizeLabel,
      value: prizePool ? formatLeagueCurrency(prizePool.amount, prizePool.currency) : 'N/D',
    },
    {
      label: 'Probabilidad combinada',
      value: summary?.combinedAliveProbabilityAvailable && summary.combinedAliveProbability !== null
        ? `${(summary.combinedAliveProbability * 100).toFixed(1)}%`
        : 'Probabilidad no disponible',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="card-base p-4">
          <p className="text-[10px] uppercase font-mono text-text-secondary font-semibold">{card.label}</p>
          <p className="text-xl font-bold text-text-primary mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function SimulationPanel({ data }: { data: ChampionSurvivorLeagueData }) {
  const simulation = data.simulation;
  const rows = simulation?.entries.slice(0, 8) ?? [];

  return (
    <div className="card-base overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl tracking-wide text-text-primary">SIMULACIÓN SEGÚN CUOTAS DE CAMPEÓN</h3>
          <p className="text-xs text-text-secondary">Basado en cuotas de campeón, no en odds de partidos.</p>
        </div>
        {simulation?.available && (
          <div className="text-left md:text-right text-[10px] font-mono text-text-secondary">
            <p>Iteraciones: <span className="text-text-primary">{simulation.iterations.toLocaleString('es-PE')}</span></p>
            <p>Última captura: <span className="text-text-primary">{formatDateTime(simulation.lastCapturedAt)}</span></p>
          </div>
        )}
      </div>

      {!simulation?.available ? (
        <p className="p-4 text-xs text-text-secondary">
          {simulation?.message || 'No disponible'}
        </p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase font-mono text-text-muted border-b border-border-subtle">
                <th className="py-2 px-4">Equipo</th>
                <th className="py-2 px-4">Probabilidad de mercado normalizada</th>
                <th className="py-2 px-4">Probabilidad simulada</th>
                <th className="py-2 px-4">Cuota</th>
                <th className="py-2 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40">
              {rows.map((entry) => (
                <tr key={entry.teamCode}>
                  <td className="py-2 px-4">
                    <p className="font-semibold text-text-primary">{entry.teamName || entry.teamCode}</p>
                    <p className="font-mono text-[10px] text-text-muted">{entry.teamCode}</p>
                  </td>
                  <td className="py-2 px-4 font-mono text-text-secondary">{formatProbability(entry.normalizedProbability)}</td>
                  <td className="py-2 px-4 font-mono text-gold-400">{formatProbability(entry.simulatedProbability)}</td>
                  <td className="py-2 px-4 font-mono text-text-secondary">
                    {entry.decimalOdds !== null ? entry.decimalOdds.toFixed(2) : 'No disponible'}
                  </td>
                  <td className="py-2 px-4 text-text-secondary uppercase font-mono text-[10px]">{statusLabel(entry.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PicksTable({
  data,
  picks,
  statusFilter,
  setStatusFilter,
  onChange,
  onReset,
}: {
  data: ChampionSurvivorLeagueData;
  picks: ChampionSurvivorPickRow[];
  statusFilter: 'all' | ChampionSurvivorPickRow['status'];
  setStatusFilter: (status: 'all' | ChampionSurvivorPickRow['status']) => void;
  onChange: (pick: ChampionSurvivorPickRow) => void;
  onReset: (pick: ChampionSurvivorPickRow) => void;
}) {
  return (
    <div className="card-base overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h3 className="font-display text-2xl tracking-wide text-text-primary">PICKS DE PARTICIPANTES</h3>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | ChampionSurvivorPickRow['status'])}
          className="field text-xs py-2 w-full md:w-48"
        >
          <option value="all">Todos</option>
          <option value="alive">Vivos</option>
          <option value="eliminated">Eliminados</option>
          <option value="pending">Sin selección</option>
          <option value="winner">Campeón acertado</option>
        </select>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-bg-secondary text-text-secondary uppercase tracking-wider text-[10px] border-b border-border-default">
            <tr>
              <th className="p-3">Usuario</th>
              <th className="p-3">Equipo elegido</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Probabilidad según mercado</th>
              <th className="p-3">Valor esperado estimado</th>
              <th className="p-3">Fecha de selección</th>
              <th className="p-3">Bloqueado</th>
              <th className="p-3">Última corrección</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/40">
            {picks.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-text-muted italic">
                  No hay picks para este filtro.
                </td>
              </tr>
            ) : (
              picks.map((pick) => (
                <tr key={pick.userId} className={`transition-colors ${rowClass(pick.status)}`}>
                  <td className="p-3">
                    <p className="font-semibold text-text-primary">{displayUser(pick)}</p>
                    <p className="text-[10px] text-text-secondary">{pick.user.username ? `@${pick.user.username}` : pick.user.email}</p>
                  </td>
                  <td className="p-3">
                    {pick.team ? (
                      <span className="flex items-center gap-2 font-semibold text-text-primary">
                        <FlagDisc code={pick.team.code} size={18} />
                        {pick.team.name} <span className="text-[10px] text-text-muted">({pick.team.code})</span>
                      </span>
                    ) : (
                      <span className="text-text-muted">Sin selección</span>
                    )}
                  </td>
                  <td className="p-3"><StatusBadge status={pick.status} /></td>
                  <td className="p-3">{formatProbability(pick.championProbability)}</td>
                  <td className="p-3">{formatExpectedValue(pick.expectedValue, data.league.currency)}</td>
                  <td className="p-3 text-text-secondary">{formatDateTime(pick.submittedAt)}</td>
                  <td className="p-3 text-text-secondary">{formatDateTime(pick.lockedAt)}</td>
                  <td className="p-3 text-text-secondary">
                    {pick.correctedAt ? (
                      <span title={pick.lastCorrectionReason || ''}>{formatDateTime(pick.correctedAt)}</span>
                    ) : (
                      'Sin corrección'
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => onChange(pick)}
                      className="px-2 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default text-[10px] rounded font-semibold text-text-primary inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 text-gold-400" /> Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={() => onReset(pick)}
                      disabled={!pick.teamCode}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[10px] rounded font-semibold text-red-400 inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamStatusPanel({
  data,
  onSetStatus,
}: {
  data: ChampionSurvivorLeagueData;
  onSetStatus: (teamCode: string, teamName: string, status: TeamTournamentStatusValue) => void;
}) {
  return (
    <div className="card-base overflow-hidden">
      <div className="p-4 border-b border-border-subtle">
        <h3 className="font-display text-2xl tracking-wide text-text-primary">ESTADO DE SELECCIONES</h3>
      </div>
      <div className="max-h-[560px] overflow-y-auto custom-scrollbar divide-y divide-border-subtle/40">
        {data.teams.map((row) => (
          <div key={row.team.code} className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary">{row.team.name} <span className="text-[10px] text-text-muted">({row.team.code})</span></p>
                <p className="text-[10px] text-text-secondary">
                  Estado actual: <span className="font-mono uppercase">{statusLabel(row.status)}</span>
                  {row.eliminatedAt ? ` · Eliminado: ${formatDateTime(row.eliminatedAt)}` : ''}
                </p>
                <p className="text-[10px] text-text-muted">
                  Sugerencia FIFA: <span className="font-mono uppercase">{qualificationSuggestionLabel(row.qualificationSuggestion)}</span>
                </p>
                {row.notes && <p className="text-[10px] text-text-muted italic mt-1">{row.notes}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSetStatus(row.team.code, row.team.name, option.value)}
                  className="px-2 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default text-[10px] rounded font-semibold text-text-primary"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OddsPanel({
  data,
  onSubmit,
  loading,
}: {
  data: ChampionSurvivorLeagueData;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
}) {
  const oddsRows = data.odds.filter((row) => row.latestSnapshot);

  return (
    <div className="card-base overflow-hidden">
      <div className="p-4 border-b border-border-subtle">
        <h3 className="font-display text-2xl tracking-wide text-text-primary">CUOTAS DE CAMPEÓN</h3>
      </div>

      <form onSubmit={onSubmit} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-border-subtle bg-bg-secondary/20">
        <select name="teamCode" className="field text-xs py-2" required>
          <option value="">-- Selección --</option>
          {data.teams.map((row) => (
            <option key={row.team.code} value={row.team.code}>{row.team.name} ({row.team.code})</option>
          ))}
        </select>
        <input name="decimalOdds" type="number" step="0.01" min="1.01" className="field text-xs py-2" placeholder="Cuota decimal > 1" required />
        <input name="provider" className="field text-xs py-2" placeholder="Proveedor, ej. manual" />
        <input name="bookmaker" className="field text-xs py-2" placeholder="Bookmaker, ej. admin" />
        <button type="submit" disabled={loading} className="btn-gold px-4 py-2 text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 md:col-span-2">
          <Save className="w-4 h-4" /> Guardar cuota manual
        </button>
      </form>

      <div className="max-h-[320px] overflow-y-auto custom-scrollbar divide-y divide-border-subtle/40">
        {oddsRows.length === 0 ? (
          <p className="p-8 text-center text-text-muted italic text-xs">Todavía no hay cuotas de campeón cargadas.</p>
        ) : (
          oddsRows.map((row) => {
            const snapshot = row.latestSnapshot;
            if (!snapshot) return null;
            return (
              <div key={row.team.code} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{row.team.name} <span className="text-[10px] text-text-muted">({row.team.code})</span></p>
                  <p className="text-[10px] text-text-secondary">{snapshot.provider} / {snapshot.bookmaker} · {formatDateTime(snapshot.capturedAt)}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-gold-400 font-bold">{snapshot.decimalOdds.toFixed(2)}</p>
                  <p className="text-[10px] text-text-secondary">{formatProbability(snapshot.impliedProbability)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DistributionPanel({
  data,
  exclusivePickRows,
}: {
  data: ChampionSurvivorLeagueData;
  exclusivePickRows: ChampionSurvivorPickRow[];
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="card-base overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <h3 className="font-display text-2xl tracking-wide text-text-primary">DISTRIBUCIÓN</h3>
        </div>
        <div className="divide-y divide-border-subtle/40">
          {data.distribution.byTeam.length === 0 ? (
            <p className="p-8 text-center text-text-muted italic text-xs">Todavía no hay picks registrados.</p>
          ) : (
            data.distribution.byTeam.map((row) => (
              <div key={row.teamCode} className="p-3 grid grid-cols-4 items-center gap-2 text-xs">
                <span className="font-mono font-bold text-text-primary">{row.teamCode}</span>
                <span>{row.count} pick{row.count === 1 ? '' : 's'}</span>
                <span>{(row.percentage * 100).toFixed(1)}%</span>
                <span className="text-text-secondary uppercase font-mono text-[10px]">{statusLabel(row.status)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <h3 className="font-display text-2xl tracking-wide text-text-primary">PICKS EXCLUSIVOS</h3>
        </div>
        <div className="divide-y divide-border-subtle/40">
          {exclusivePickRows.length === 0 ? (
            <p className="p-8 text-center text-text-muted italic text-xs">No hay picks exclusivos.</p>
          ) : (
            exclusivePickRows.map((pick) => (
              <div key={pick.userId} className="p-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-text-primary">{displayUser(pick)}</span>
                <span className="font-mono text-gold-400">{pick.team?.name || pick.teamCode}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActionModal({
  title,
  description,
  confirmLabel,
  children,
  onClose,
  onConfirm,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md card-base p-6 border-border-active space-y-4 bg-bg-tertiary">
        <h3 className="font-display text-2xl text-gold-400 tracking-wide">{title}</h3>
        <p className="text-xs text-text-secondary">{description}</p>
        <div className="space-y-4">{children}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-xs font-mono uppercase">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="btn-gold px-4 py-2 text-xs font-mono uppercase flex items-center gap-2">
            {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonField({
  value,
  setValue,
  label = 'Motivo obligatorio',
}: {
  value: string;
  setValue: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        className="field text-xs py-2 w-full"
        placeholder="Describe el motivo administrativo."
      />
    </div>
  );
}

function StatusBadge({ status }: { status: ChampionSurvivorPickRow['status'] }) {
  const classes = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    alive: 'bg-green-500/10 text-green-400 border-green-500/30',
    eliminated: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    winner: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
  }[status];

  return (
    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase ${classes}`}>
      {statusLabel(status)}
    </span>
  );
}

function displayUser(pick: ChampionSurvivorPickRow) {
  return pick.user.displayName || pick.user.name;
}

function rowClass(status: ChampionSurvivorPickRow['status']) {
  if (status === 'eliminated') return 'opacity-60 bg-bg-secondary/20';
  if (status === 'winner') return 'bg-gold-500/5 hover:bg-gold-500/10';
  return 'hover:bg-bg-hover/20';
}

function statusLabel(status: string) {
  if (status === 'pending') return 'Sin selección';
  if (status === 'alive') return 'Vivo';
  if (status === 'eliminated') return 'Eliminado';
  if (status === 'winner') return 'Campeón acertado';
  if (status === 'active') return 'Activo';
  if (status === 'runner_up') return 'Subcampeón';
  if (status === 'champion') return 'Campeón';
  return 'Desconocido';
}

function qualificationSuggestionLabel(status: string) {
  if (status === 'active') return 'Vivo';
  if (status === 'eliminated') return 'Eliminado';
  return 'Pendiente';
}

function formatProbability(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Probabilidad no disponible';
  return `${(value * 100).toFixed(1)}%`;
}

function formatExpectedValue(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined) return 'No disponible';
  return formatLeagueCurrency(value, currency);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'N/D';
  return new Date(value).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
