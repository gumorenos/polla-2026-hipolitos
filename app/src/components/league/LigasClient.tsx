'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Users, Plus, ArrowRight, Clipboard, CheckCircle, AlertCircle, X } from 'lucide-react';
import { formatLeagueCurrency } from '../../lib/utils/currency';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createLeagueAction } from '../../lib/actions/leagues';
import { parseLimaDateTimeToUtc } from '../../lib/utils/dates';
import {
  getCompetitionTypeLabel,
  getCompetitionTypeSubtitle,
  type CompetitionTypeValue,
} from '../../lib/competition-types';

interface LeagueData {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  status: string;
  createdAt: string;
  entryFee?: number;
  currency?: string;
  prizePoolOverride?: number | null;
  activeMembersCount?: number;
  inactiveMembersCount?: number;
  totalMembersCount?: number;
  competitionType?: string;
  _count?: {
    members: number;
  };
}

interface LeagueMembership {
  id: string;
  leagueId: string;
  userId: string;
  role: string;
  joinedAt: string;
  league: LeagueData;
}

type CompetitionTypeOption = CompetitionTypeValue;

interface LigasClientProps {
  memberships: LeagueMembership[];
  initialCompetitionType?: CompetitionTypeOption;
  openCreateModal?: boolean;
}

export const LigasClient: React.FC<LigasClientProps> = ({
  memberships,
  initialCompetitionType = 'full_prediction',
  openCreateModal = false,
}) => {
  const router = useRouter();
  const createNameInputRef = useRef<HTMLInputElement>(null);
  const createNameFocusedRef = useRef(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [competitionType, setCompetitionType] = useState<CompetitionTypeOption>(initialCompetitionType);
  const [championDeadline, setChampionDeadline] = useState('');
  const [joinAsParticipant, setJoinAsParticipant] = useState(false);
  const [showOdds, setShowOdds] = useState(initialCompetitionType !== 'match_pool');
  const [showH2H, setShowH2H] = useState(true);
  const [matchPoolLateEntryEnabled, setMatchPoolLateEntryEnabled] = useState(false);
  const [matchPoolLateEntryMinutes, setMatchPoolLateEntryMinutes] = useState(45);
  const [showCreateModal, setShowCreateModal] = useState(openCreateModal);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!showCreateModal) {
      createNameFocusedRef.current = false;
      return;
    }
    if (createNameFocusedRef.current) return;
    createNameFocusedRef.current = true;
    createNameInputRef.current?.focus();
  }, [showCreateModal]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const result = await createLeagueAction({
      name: newLeagueName,
      competitionType,
      championDeadline: competitionType === 'match_pool' ? null : (championDeadline ? parseLimaDateTimeToUtc(championDeadline) : null),
      joinAsParticipant: competitionType === 'match_pool' ? false : joinAsParticipant,
      showOdds: competitionType === 'match_pool' ? false : showOdds,
      showH2H,
      matchPoolLateEntryEnabled: competitionType === 'match_pool' ? matchPoolLateEntryEnabled : false,
      matchPoolLateEntryMinutes: competitionType === 'match_pool' ? matchPoolLateEntryMinutes : 45,
    });

    if (result.error) {
      setErrorMsg(result.error);
      setLoading(false);
    } else {
      setNewLeagueName('');
      setCompetitionType('full_prediction');
      setChampionDeadline('');
      setJoinAsParticipant(false);
      setShowOdds(true);
      setShowH2H(true);
      setMatchPoolLateEntryEnabled(false);
      setMatchPoolLateEntryMinutes(45);
      setShowCreateModal(false);
      setLoading(false);
      if (result.data) {
        router.push(`/competencia/${result.data.slug}`);
      }
    }
  };


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-text-primary">MIS COMPETENCIAS</h2>
          <p className="text-text-secondary text-sm">Crea competencias privadas o únete a las de tus amigos.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="btn-gold text-sm py-2 px-4 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Crear Competencia
        </button>
      </div>

      {/* Leagues List and Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Leagues List (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {memberships.length === 0 ? (
            <div className="card-base p-8 text-center border-dashed border-border-default/60 flex flex-col items-center justify-center min-h-[220px]">
              <Users className="w-12 h-12 text-text-muted mb-3" />
              <h3 className="font-bold text-text-primary text-base">No perteneces a ninguna competencia</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm">
                Crea una competencia nueva con el botón superior o escribe un código de invitación para ingresar a una competencia privada.
              </p>
            </div>
          ) : (
            memberships.map((membership) => {
              const league = membership.league;
              const isCopied = copiedCode === league.inviteCode;
              return (
                <div
                  key={membership.id}
                  className="card-base p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                     <div className="flex items-center gap-2 flex-wrap">
                       <h3 className="text-lg font-bold text-text-primary">{league.name}</h3>
                       {membership.role === 'owner' && (
                         <span className="text-[9px] font-mono font-semibold bg-gold-400/10 text-gold-400 border border-gold-400/30 px-2 py-0.5 rounded-full uppercase">
                           Dueño
                         </span>
                       )}
                       {membership.role === 'admin' && (
                         <span className="text-[9px] font-mono font-semibold bg-blue-400/10 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase">
                           Admin
                         </span>
                       )}
                       {league.competitionType === 'full_prediction' && (
                         <span className="text-[9px] font-mono font-semibold bg-green-400/10 text-green-300 border border-green-400/30 px-2 py-0.5 rounded-full uppercase">
                           {getCompetitionTypeLabel('full_prediction')}
                         </span>
                       )}
                       {league.competitionType === 'champion_survivor' && (
                         <span className="text-[9px] font-mono font-semibold bg-purple-400/10 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full uppercase">
                           {getCompetitionTypeLabel('champion_survivor')}
                         </span>
                       )}
                       {league.competitionType === 'match_pool' && (
                         <span className="text-[9px] font-mono font-semibold bg-orange-400/10 text-orange-300 border border-orange-400/30 px-2 py-0.5 rounded-full uppercase">
                           {getCompetitionTypeLabel('match_pool')}
                         </span>
                       )}
                     </div>
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      {league.competitionType === 'match_pool' ? (
                        <span className="text-text-muted">Sin miembros fijos · participación por reto</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-gold-400" />
                          {league.activeMembersCount !== undefined ? (
                          <span>
                            <span className="text-green-400 font-semibold">{league.activeMembersCount} activo{league.activeMembersCount !== 1 ? 's' : ''}</span>
                            {league.inactiveMembersCount !== undefined && league.inactiveMembersCount > 0 ? (
                              <span className="text-text-muted"> · {league.inactiveMembersCount} inactivo{league.inactiveMembersCount !== 1 ? 's' : ''}/bloqueado{league.inactiveMembersCount !== 1 ? 's' : ''}</span>
                            ) : null}
                            <span className="text-text-muted"> ({league.totalMembersCount} total)</span>
                          </span>
                          ) : (
                            `${league._count?.members ?? 1} miembros`
                          )}
                        </span>
                      )}
                      {league.competitionType !== 'match_pool' && (league.entryFee ?? 0) > 0 && (
                        <span className="flex items-center gap-1 font-mono font-semibold text-gold-400">
                          {(() => {
                            const memberCount = league.activeMembersCount ?? league._count?.members ?? 1;
                            const prize = league.prizePoolOverride ?? (memberCount * (league.entryFee ?? 0));
                            return `Pozo: ${formatLeagueCurrency(prize, league.currency ?? 'PEN')}`;
                          })()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Share Invite Code */}
                    {league.competitionType !== 'match_pool' && (
                      <div className="bg-bg-secondary border border-border-default px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <span className="text-[10px] text-text-secondary uppercase font-mono tracking-wider">CÓDIGO:</span>
                        <span className="font-mono text-sm font-bold text-gold-400">{league.inviteCode}</span>
                        <button
                          type="button"
                          title="Copiar Código"
                          onClick={() => handleCopyCode(league.inviteCode)}
                          className="text-text-muted hover:text-gold-400 transition-all flex items-center gap-1"
                        >
                          {isCopied ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Clipboard className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    <Link href={`/competencia/${league.slug}`} className="btn-ghost flex items-center gap-1 text-sm py-1.5 px-3">
                      Ingresar <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Join League Form (Right 1 col) */}
        <div className="card-base p-5 space-y-4">
          <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Unirse a Competencia</h3>
          <p className="text-xs text-text-secondary">
            Ingresa el código de invitación que te compartió el administrador de la competencia.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Ej. HIPO2026"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
              className="field font-mono tracking-widest text-center"
            />
            <Link
              href={`/join/${inviteCodeInput || 'TEMP'}`}
              className={`w-full btn-gold py-2 px-4 text-center text-sm flex items-center justify-center gap-1 ${
                !inviteCodeInput.trim() ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              Unirse a Competencia
            </Link>
          </div>
        </div>
      </div>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="card-base p-6 max-w-md w-full border-border-active space-y-4 relative">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-display text-2xl tracking-wide text-text-primary">CREAR NUEVA COMPETENCIA</h3>

            {errorMsg && (
              <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Nombre de la Competencia
                </label>
                <input
                  ref={createNameInputRef}
                  type="text"
                  placeholder="Ej. Amigos del Fútbol"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="field"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Tipo de competencia
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    competitionType === 'full_prediction'
                      ? 'border-gold-400 bg-gold-400/10'
                      : 'border-border-default bg-bg-secondary/40 hover:bg-bg-hover'
                  }`}>
                    <input
                      type="radio"
                      name="competitionType"
                      value="full_prediction"
                      checked={competitionType === 'full_prediction'}
                      onChange={() => setCompetitionType('full_prediction')}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span className="block text-sm font-semibold text-text-primary">{getCompetitionTypeLabel('full_prediction')}</span>
                    <span className="block text-[10px] text-text-secondary mt-1">{getCompetitionTypeSubtitle('full_prediction')}</span>
                  </label>
                  <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    competitionType === 'champion_survivor'
                      ? 'border-gold-400 bg-gold-400/10'
                      : 'border-border-default bg-bg-secondary/40 hover:bg-bg-hover'
                  }`}>
                    <input
                      type="radio"
                      name="competitionType"
                      value="champion_survivor"
                      checked={competitionType === 'champion_survivor'}
                      onChange={() => setCompetitionType('champion_survivor')}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span className="block text-sm font-semibold text-text-primary">{getCompetitionTypeLabel('champion_survivor')}</span>
                    <span className="block text-[10px] text-text-secondary mt-1">{getCompetitionTypeSubtitle('champion_survivor')}</span>
                  </label>
                  <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    competitionType === 'match_pool'
                      ? 'border-gold-400 bg-gold-400/10'
                      : 'border-border-default bg-bg-secondary/40 hover:bg-bg-hover'
                  }`}>
                    <input
                      type="radio"
                      name="competitionType"
                      value="match_pool"
                      checked={competitionType === 'match_pool'}
                      onChange={() => {
                        setCompetitionType('match_pool');
                        setShowOdds(false);
                      }}
                      className="sr-only"
                      disabled={loading}
                    />
                    <span className="block text-sm font-semibold text-text-primary">{getCompetitionTypeLabel('match_pool')}</span>
                    <span className="block text-[10px] text-text-secondary mt-1">{getCompetitionTypeSubtitle('match_pool')}</span>
                  </label>
                </div>
              </div>
              {competitionType !== 'match_pool' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Fecha límite para elegir campeón (Hora Lima)
                  </label>
                  <input
                    type="datetime-local"
                    value={championDeadline}
                    onChange={(e) => setChampionDeadline(e.target.value)}
                    className="field"
                    disabled={loading}
                  />
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    Puedes configurarla después, pero recomendamos definir una fecha límite antes de invitar participantes.
                  </p>
                </div>
              )}
               {competitionType === 'match_pool' ? (
                <>
                  <div className="p-3 rounded-xl bg-bg-secondary/40 border border-border-default text-xs text-text-secondary leading-relaxed">
                    <span className="block font-semibold text-text-primary">Participación abierta por reto</span>
                    En Retos por Partido no hay miembros fijos ni ranking global. Cada persona aprobada entra voluntariamente a cada reto por partido.
                  </div>
                  <div className="space-y-3 rounded-xl border border-border-default bg-bg-secondary/40 p-3">
                    <span className="block text-xs font-semibold text-text-primary uppercase tracking-wider">Configuración de entrada tardía</span>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={matchPoolLateEntryEnabled}
                        onChange={(e) => setMatchPoolLateEntryEnabled(e.target.checked)}
                        className="mt-0.5"
                        disabled={loading}
                      />
                      <span className="text-xs text-text-secondary leading-relaxed">
                        <span className="block font-semibold text-text-primary">Permitir entrada tardía a retos</span>
                        Permite crear, invitar o unirse a retos después del inicio del partido.
                      </span>
                    </label>
                    {matchPoolLateEntryEnabled && (
                      <label className="block text-xs text-text-secondary">
                        Minutos después del inicio
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={matchPoolLateEntryMinutes}
                          onChange={(e) => setMatchPoolLateEntryMinutes(Number(e.target.value))}
                          className="field mt-1 py-1 w-full"
                          disabled={loading}
                        />
                      </label>
                    )}
                    <p className="text-[10px] text-amber-300 leading-relaxed">
                      ⚠️ Advertencia: Si se habilita, los usuarios podrían entrar con información parcial del partido.
                    </p>
                  </div>
                </>
              ) : (
                <label className="flex items-start gap-2 p-3 rounded-xl bg-bg-secondary/40 border border-border-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinAsParticipant}
                    onChange={(e) => setJoinAsParticipant(e.target.checked)}
                    className="mt-0.5"
                    disabled={loading}
                  />
                  <span className="text-xs text-text-secondary leading-relaxed">
                    <span className="block font-semibold text-text-primary">Inscribirme también como participante</span>
                    Si no marcas esta opción, crearás y administrarás la competencia como dueño sin contar como jugador activo.
                  </span>
                </label>
              )}
              <div className="space-y-2">
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Puedes desactivar estas ayudas para hacer la competencia más difícil.
                </p>
                <label className="flex items-start gap-2 p-3 rounded-xl bg-bg-secondary/40 border border-border-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOdds}
                    onChange={(e) => setShowOdds(e.target.checked)}
                    className="mt-0.5"
                    disabled={loading || competitionType === 'match_pool'}
                  />
                  <span className="text-xs text-text-secondary leading-relaxed">
                    <span className="block font-semibold text-text-primary">Mostrar odds</span>
                    {competitionType === 'match_pool' ? (
                      <span>En Retos por Partido las cuotas están ocultas por defecto. Si se activan después desde admin, deben ser solo cuotas pre-partido congeladas.</span>
                    ) : (
                      <span>Muestra ayudas de mercado cuando existan datos cacheados.</span>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2 p-3 rounded-xl bg-bg-secondary/40 border border-border-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showH2H}
                    onChange={(e) => setShowH2H(e.target.checked)}
                    className="mt-0.5"
                    disabled={loading}
                  />
                  <span className="text-xs text-text-secondary leading-relaxed">
                    <span className="block font-semibold text-text-primary">Mostrar historial / H2H</span>
                    Muestra estadísticas de enfrentamientos directos cuando existan datos cacheados.
                  </span>
                </label>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">
                {competitionType === 'match_pool'
                  ? 'La competencia funcionará como lobby abierto para usuarios aprobados; cada reto gestiona su propia participación.'
                  : 'Una vez creada, generaremos un código de invitación único. Podrás compartir este código para que otros se unan.'}
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-ghost py-2 px-4 text-xs"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-gold py-2 px-4 text-xs flex items-center gap-1"
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
