'use client';

import React, { useState, useMemo } from 'react';
import { Trophy, ShieldAlert, CheckCircle, Search, RefreshCw, KeyRound, Sparkles, AlertCircle, History } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import {
  allowWinnerPredictionCorrectionAction,
  directCorrectWinnerPredictionAction,
} from '../../../lib/actions/predictions';
import { useRouter } from 'next/navigation';

interface SerializedPrediction {
  id: string;
  userId: string;
  userName: string;
  userUsername: string | null;
  userEmail: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  teamCode: string;
  teamName: string;
  pointsEarned: number | null;
  createdAt: string;
  updatedAt: string;
  correctionAllowed: boolean;
  correctionAllowedUntil: string | null;
  correctionReason: string | null;
}

interface SerializedHistory {
  id: string;
  leagueId: string;
  leagueName: string;
  userId: string;
  userName: string;
  userUsername: string | null;
  oldTeamCode: string | null;
  newTeamCode: string;
  actionType: string;
  authorizedById: string | null;
  changedById: string | null;
  reason: string | null;
  createdAt: string;
}

interface AdminChampionClientProps {
  predictions: SerializedPrediction[];
  histories: SerializedHistory[];
  teams: { code: string; name: string }[];
  leagues: { id: string; name: string }[];
  users: { id: string; name: string; displayName: string | null; username: string | null }[];
}

export const AdminChampionClient: React.FC<AdminChampionClientProps> = ({
  predictions,
  histories,
  teams,
  leagues,
  users,
}) => {
  const router = useRouter();
  
  // Search / filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  
  // Modals state
  const [activePrediction, setActivePrediction] = useState<SerializedPrediction | null>(null);
  const [modalType, setModalType] = useState<'authorize' | 'direct' | 'history' | null>(null);
  
  // Form values
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [mandatoryReason, setMandatoryReason] = useState('');
  const [directTeamCode, setDirectTeamCode] = useState('');
  
  // General status
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New prediction creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPredUserId, setNewPredUserId] = useState('');
  const [newPredLeagueId, setNewPredLeagueId] = useState('');
  const [newPredTeamCode, setNewPredTeamCode] = useState('');
  const [newPredReason, setNewPredReason] = useState('');

  // Filtered list
  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      const matchesSearch =
        p.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.userUsername && p.userUsername.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLeague = selectedLeagueId === '' || p.leagueId === selectedLeagueId;
      
      return matchesSearch && matchesLeague;
    });
  }, [predictions, searchTerm, selectedLeagueId]);

  const handleOpenAuthorize = (pred: SerializedPrediction) => {
    setActivePrediction(pred);
    setModalType('authorize');
    setMandatoryReason('');
    setDurationMinutes(30);
    setStatusMsg(null);
  };

  const handleOpenDirect = (pred: SerializedPrediction) => {
    setActivePrediction(pred);
    setModalType('direct');
    setMandatoryReason('');
    setDirectTeamCode(pred.teamCode);
    setStatusMsg(null);
  };

  const handleOpenHistory = (pred: SerializedPrediction) => {
    setActivePrediction(pred);
    setModalType('history');
    setStatusMsg(null);
  };

  const handleExecuteAuthorize = async () => {
    if (!activePrediction) return;
    if (!mandatoryReason.trim()) {
      alert('El motivo de la corrección es obligatorio.');
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    const res = await allowWinnerPredictionCorrectionAction(
      activePrediction.leagueId,
      activePrediction.userId,
      durationMinutes,
      mandatoryReason
    );

    setLoading(false);
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({ type: 'success', text: `Corrección habilitada por ${durationMinutes} minutos.` });
      setModalType(null);
      setActivePrediction(null);
      router.refresh();
    }
  };

  const handleExecuteDirect = async () => {
    if (!activePrediction) return;
    if (!mandatoryReason.trim()) {
      alert('El motivo del cambio es obligatorio.');
      return;
    }
    if (!directTeamCode) {
      alert('Por favor selecciona una selección.');
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    const res = await directCorrectWinnerPredictionAction(
      activePrediction.leagueId,
      activePrediction.userId,
      directTeamCode,
      mandatoryReason
    );

    setLoading(false);
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({ type: 'success', text: 'Predicción de campeón corregida con éxito.' });
      setModalType(null);
      setActivePrediction(null);
      router.refresh();
    }
  };

  const handleCreateNewPrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPredUserId || !newPredLeagueId || !newPredTeamCode || !newPredReason.trim()) {
      alert('Todos los campos son obligatorios para crear una predicción.');
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    const res = await directCorrectWinnerPredictionAction(
      newPredLeagueId,
      newPredUserId,
      newPredTeamCode,
      newPredReason
    );

    setLoading(false);
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({ type: 'success', text: 'Predicción de campeón creada exitosamente.' });
      setShowCreateModal(false);
      setNewPredUserId('');
      setNewPredLeagueId('');
      setNewPredTeamCode('');
      setNewPredReason('');
      router.refresh();
    }
  };

  const activePredictionHistories = useMemo(() => {
    if (!activePrediction) return [];
    return histories.filter(
      (h) => h.userId === activePrediction.userId && h.leagueId === activePrediction.leagueId
    );
  }, [histories, activePrediction]);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por nombre, usuario o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field field-icon-left text-xs py-2 pr-4 pl-9 rounded-xl w-full"
            />
          </div>

          <select
            value={selectedLeagueId}
            onChange={(e) => setSelectedLeagueId(e.target.value)}
            className="field text-xs py-2 px-3 rounded-xl w-full sm:w-48"
          >
            <option value="">-- Todas las pollas --</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="btn-gold py-2 px-4 text-xs uppercase font-mono tracking-wider font-semibold whitespace-nowrap self-stretch sm:self-auto"
        >
          Crear Predicción
        </button>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 animate-[slideUp_0.2s_ease-out] ${
            statusMsg.type === 'success'
              ? 'bg-green-400/10 border-green-500/20 text-green-400'
              : 'bg-red-400/10 border-red-500/20 text-red-400'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Grid of Predictions */}
      <div className="card-base p-0 overflow-hidden border-border-default/80">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap font-mono">
            <thead className="bg-bg-secondary text-text-secondary uppercase tracking-wider text-[10px] border-b border-border-default">
              <tr>
                <th className="p-4 font-semibold">Usuario</th>
                <th className="p-4 font-semibold">Polla / Competencia</th>
                <th className="p-4 font-semibold">Predicción</th>
                <th className="p-4 font-semibold">Estado de Bloqueo</th>
                <th className="p-4 font-semibold">Última Act.</th>
                <th className="p-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40">
              {filteredPredictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted italic">
                    No se encontraron predicciones de campeón que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filteredPredictions.map((p) => {
                  const isCorrectionActive =
                    p.correctionAllowed &&
                    p.correctionAllowedUntil &&
                    new Date(p.correctionAllowedUntil) > new Date();

                  return (
                    <tr key={p.id} className="hover:bg-bg-hover/20 transition-colors">
                      <td className="p-4">
                        <div className="font-sans font-semibold text-text-primary">{p.userName}</div>
                        <div className="text-[10px] text-text-secondary">
                          {p.userUsername ? `@${p.userUsername}` : p.userEmail}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-sans text-text-secondary">{p.leagueName}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-sans font-semibold text-text-primary">
                          <FlagDisc code={p.teamCode} size={18} />
                          <span>{p.teamName}</span>
                          <span className="text-[10px] text-text-muted font-mono uppercase">({p.teamCode})</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {isCorrectionActive ? (
                          <span className="text-[9px] font-mono font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-max">
                            <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Corrección Abierta
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full uppercase w-max block">
                            Bloqueado
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-text-secondary text-[10px]">
                        {new Date(p.updatedAt).toLocaleString('es-PE', {
                          timeZone: 'America/Lima',
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAuthorize(p)}
                          className="px-2 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] rounded font-semibold text-text-primary transition-all inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3 text-gold-400" /> Permitir Corrección
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDirect(p)}
                          className="px-2 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] rounded font-semibold text-text-primary transition-all inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3 text-gold-400" /> Corregir Directo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(p)}
                          className="px-2 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] rounded font-semibold text-text-primary transition-all inline-flex items-center gap-1"
                        >
                          <History className="w-3 h-3 text-text-secondary" /> Historial
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Authorize Correction */}
      {modalType === 'authorize' && activePrediction && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md card-base p-6 border-border-active space-y-4 bg-bg-tertiary">
            <h3 className="font-display text-2xl text-gold-400 tracking-wide flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Autorizar Corrección de Campeón
            </h3>
            
            <div className="text-xs text-text-secondary space-y-1">
              <p>Habilitarás temporalmente la edición del campeón para:</p>
              <p className="font-semibold text-text-primary font-sans">
                {activePrediction.userName} (@{activePrediction.userUsername || 'sin_usuario'})
              </p>
              <p>Polla: <span className="text-text-primary">{activePrediction.leagueName}</span></p>
              <p>Elección Actual: <span className="text-text-primary font-bold">{activePrediction.teamName} ({activePrediction.teamCode})</span></p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Duración de la Ventana (Minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
                  className="field text-xs py-1.5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Motivo Mandatorio de la Autorización
                </label>
                <textarea
                  placeholder="Ej: Usuario se equivocó de equipo al registrarse el primer día."
                  value={mandatoryReason}
                  onChange={(e) => setMandatoryReason(e.target.value)}
                  rows={3}
                  className="field text-xs py-1.5"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-default rounded-xl text-xs uppercase font-mono transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAuthorize}
                  disabled={loading}
                  className="btn-gold py-2 px-4 text-xs font-mono uppercase flex items-center gap-1.5"
                >
                  {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Habilitar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Direct Correction */}
      {modalType === 'direct' && activePrediction && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md card-base p-6 border-border-active space-y-4 bg-bg-tertiary">
            <h3 className="font-display text-2xl text-gold-400 tracking-wide flex items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin-slow" /> Corregir Campeón Directamente
            </h3>
            
            <div className="text-xs text-text-secondary space-y-1">
              <p>Cambiarás la predicción de campeón directamente para:</p>
              <p className="font-semibold text-text-primary font-sans">
                {activePrediction.userName}
              </p>
              <p>Polla: <span className="text-text-primary">{activePrediction.leagueName}</span></p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Nueva Selección Campeona
                </label>
                <select
                  value={directTeamCode}
                  onChange={(e) => setDirectTeamCode(e.target.value)}
                  className="field text-xs py-1.5"
                  required
                >
                  <option value="">-- Selecciona País --</option>
                  {teams.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Motivo Mandatorio del Cambio
                </label>
                <textarea
                  placeholder="Ej: Cambio solicitado directamente por WhatsApp por problemas de red."
                  value={mandatoryReason}
                  onChange={(e) => setMandatoryReason(e.target.value)}
                  rows={3}
                  className="field text-xs py-1.5"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-default rounded-xl text-xs uppercase font-mono transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDirect}
                  disabled={loading}
                  className="btn-gold py-2 px-4 text-xs font-mono uppercase flex items-center gap-1.5"
                >
                  {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Guardar Cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Prediction Change History */}
      {modalType === 'history' && activePrediction && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg card-base p-6 border-border-active space-y-4 bg-bg-tertiary">
            <div className="flex justify-between items-center border-b border-border-subtle pb-2">
              <h3 className="font-display text-2xl text-gold-400 tracking-wide flex items-center gap-2">
                <History className="w-5 h-5" /> Historial de Cambios
              </h3>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-text-muted hover:text-text-primary text-xs font-mono font-bold"
              >
                CERRAR [X]
              </button>
            </div>

            <div className="text-xs text-text-secondary">
              <p>Cambios registrados para <strong className="text-text-primary font-sans">{activePrediction.userName}</strong> en <strong className="text-text-primary font-sans">{activePrediction.leagueName}</strong>:</p>
            </div>

            <div className="divide-y divide-border-subtle max-h-64 overflow-y-auto pr-1 space-y-3">
              {activePredictionHistories.length === 0 ? (
                <p className="text-center text-text-muted italic py-8 text-xs">No hay cambios auditados para esta predicción.</p>
              ) : (
                activePredictionHistories.map((h) => (
                  <div key={h.id} className="pt-3 first:pt-0 text-xs space-y-1 font-sans">
                    <div className="flex justify-between text-[10px] font-mono text-text-secondary">
                      <span className="font-bold text-gold-400 uppercase tracking-wide">{h.actionType}</span>
                      <span>
                        {new Date(h.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                      </span>
                    </div>
                    <p className="text-text-primary">
                      Selección: <strong className="text-text-primary font-mono">{h.oldTeamCode || 'NINGUNA'} &rarr; {h.newTeamCode}</strong>
                    </p>
                    {h.reason && (
                      <p className="text-text-secondary text-[11px] bg-black/15 p-2 rounded border border-border-subtle/50 italic mt-1">
                        Motivo: &quot;{h.reason}&quot;
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-default rounded-xl text-xs uppercase font-mono transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Winner Prediction */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateNewPrediction} className="w-full max-w-md card-base p-6 border-border-active space-y-4 bg-bg-tertiary">
            <h3 className="font-display text-2xl text-gold-400 tracking-wide flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-400" /> Registrar Campeón Inicial
            </h3>
            
            <p className="text-xs text-text-secondary">
              Registra una elección inicial de campeón para un usuario que no tiene ninguna.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Usuario Aprobado
                </label>
                <select
                  value={newPredUserId}
                  onChange={(e) => setNewPredUserId(e.target.value)}
                  className="field text-xs py-1.5"
                  required
                >
                  <option value="">-- Selecciona Usuario --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.name} ({u.username ? `@${u.username}` : u.id.substring(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Competencia (Polla)
                </label>
                <select
                  value={newPredLeagueId}
                  onChange={(e) => setNewPredLeagueId(e.target.value)}
                  className="field text-xs py-1.5"
                  required
                >
                  <option value="">-- Selecciona Polla --</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Selección Campeona
                </label>
                <select
                  value={newPredTeamCode}
                  onChange={(e) => setNewPredTeamCode(e.target.value)}
                  className="field text-xs py-1.5"
                  required
                >
                  <option value="">-- Selecciona Selección --</option>
                  {teams.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Motivo de la creación directa
                </label>
                <textarea
                  placeholder="Ej: Registro manual solicitado por correo."
                  value={newPredReason}
                  onChange={(e) => setNewPredReason(e.target.value)}
                  rows={2}
                  className="field text-xs py-1.5"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-default rounded-xl text-xs uppercase font-mono transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold py-2 px-4 text-xs font-mono uppercase flex items-center gap-1.5"
                >
                  {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Registrar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
