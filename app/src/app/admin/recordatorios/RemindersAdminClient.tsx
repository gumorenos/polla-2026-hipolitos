'use client';

import React, { useState } from 'react';
import { Mail, Settings, AlertCircle, CheckCircle2, XCircle, ArrowLeft, RefreshCw, ShieldAlert, Award } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateAppSettingAction } from '../../../lib/actions/admin';

interface LogData {
  id: string;
  reminderType: string;
  channel: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  provider: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  user: {
    name: string;
    email: string;
    displayName: string | null;
    username: string | null;
  };
  match: {
    homeTeamCode: string;
    awayTeamCode: string;
    kickoffUtc: string;
  };
  league: {
    name: string;
  };
}

interface RemindersAdminClientProps {
  config: {
    remindersEnabled: boolean;
    emailRemindersEnabled: boolean;
    dbRemindersEnabled: boolean;
    dbEmailRemindersEnabled: boolean;
    hasResendKey: boolean;
    fromEmail: string;
  };
  stats: {
    sent: number;
    failed: number;
    skippedPrediction: number;
    skippedNotOptedIn: number;
  };
  logs: LogData[];
}

function maskEmail(email: string): string {
  if (!email) return 'NO_EMAIL';
  if (email.endsWith('@polla.local')) return 'Placeholder';
  const parts = email.split('@');
  if (parts.length !== 2) return 'Email inválido';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export const RemindersAdminClient: React.FC<RemindersAdminClientProps> = ({ config, stats, logs }) => {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [remindersGlobally, setRemindersGlobally] = useState(config.dbRemindersEnabled);
  const [emailRemindersGlobally, setEmailRemindersGlobally] = useState(config.dbEmailRemindersEnabled);
  const [toggling, setToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleToggleSetting = async (key: 'remindersGloballyEnabled' | 'emailRemindersGloballyEnabled', checked: boolean) => {
    setToggling(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const value = checked ? 'true' : 'false';
    const res = await updateAppSettingAction(key, value);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      if (key === 'remindersGloballyEnabled') {
        setRemindersGlobally(checked);
      } else {
        setEmailRemindersGlobally(checked);
      }
      setSuccessMsg('Configuración operativa actualizada en la base de datos');
      router.refresh();
    }
    setToggling(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'failed':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'skipped':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'dry_run':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default:
        return 'bg-bg-secondary border-border-default text-text-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Enviado';
      case 'failed':
        return 'Fallido';
      case 'skipped':
        return 'Omitido';
      case 'dry_run':
        return 'Simulación';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl xl:max-w-[1400px] mx-auto p-4 md:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded-xl border border-border-default transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-display uppercase tracking-wide text-text-primary">
              Recordatorios por Email
            </h1>
            <p className="text-xs text-text-secondary">
              Auditoría y configuración del sistema de alertas de predicciones pendientes.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-gold py-2 px-4 flex items-center gap-1.5 w-fit self-end text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refrescar Datos
        </button>
      </div>

      {/* Configurations Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base p-4 flex items-start gap-3 justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold">Recordatorios Generales</span>
            <p className="text-lg font-bold text-text-primary mt-1">
              {config.remindersEnabled ? 'HABILITADOS' : 'DESHABILITADOS'}
            </p>
            <p className="text-[10px] text-text-muted">REMINDERS_ENABLED en .env.local</p>
          </div>
          {config.remindersEnabled ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500 shrink-0" />
          )}
        </div>

        <div className="card-base p-4 flex items-start gap-3 justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold">Alertas por Correo</span>
            <p className="text-lg font-bold text-text-primary mt-1">
              {config.emailRemindersEnabled ? 'HABILITADAS' : 'DESHABILITADAS'}
            </p>
            <p className="text-[10px] text-text-muted">EMAIL_REMINDERS_ENABLED en .env.local</p>
          </div>
          {config.emailRemindersEnabled ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500 shrink-0" />
          )}
        </div>

        <div className="card-base p-4 flex items-start gap-3 justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold">Proveedor de Email</span>
            <p className="text-lg font-bold text-text-primary mt-1">
              {config.hasResendKey ? 'RESEND LISTO' : 'SIN CONFIGURAR'}
            </p>
            <p className="text-[10px] text-text-muted">De: {config.fromEmail}</p>
          </div>
          {config.hasResendKey ? (
            <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
          <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Settings Switches */}
      <div className="card-base p-5 border-border-default/60 space-y-4">
        <h4 className="font-semibold text-sm text-gold-400 uppercase tracking-wider font-mono">
          Interruptores Operativos (Base de Datos)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-xl border border-border-default/80">
            <div className="space-y-1">
              <span className="text-xs font-bold text-text-primary block">
                Recordatorios Globales
              </span>
              <span className="text-[10px] text-text-secondary">
                Activa o desactiva de forma absoluta todo el sistema de recordatorios.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remindersGlobally}
                disabled={toggling}
                onChange={(e) => handleToggleSetting('remindersGloballyEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-default rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-text-secondary after:border-border-default after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold peer-checked:after:bg-background"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-xl border border-border-default/80">
            <div className="space-y-1">
              <span className="text-xs font-bold text-text-primary block">
                Recordatorios por Email
              </span>
              <span className="text-[10px] text-text-secondary">
                Permite o bloquea el envío de correos recordatorios salientes.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={emailRemindersGlobally}
                disabled={toggling}
                onChange={(e) => handleToggleSetting('emailRemindersGloballyEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border-default rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-text-secondary after:border-border-default after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold peer-checked:after:bg-background"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Daily Metrics Dashboard */}
      <div className="space-y-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gold-400">
          Métricas de Hoy (Hora Lima)
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-secondary border border-border-default rounded-xl p-4 text-center">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block">Enviados Hoy</span>
            <p className="text-3xl font-bold font-mono mt-1 text-green-400">{stats.sent}</p>
          </div>

          <div className="bg-bg-secondary border border-border-default rounded-xl p-4 text-center">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block">Fallidos Hoy</span>
            <p className="text-3xl font-bold font-mono mt-1 text-red-400">{stats.failed}</p>
          </div>

          <div className="bg-bg-secondary border border-border-default rounded-xl p-4 text-center">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block">Omitidos (Predicción Lista)</span>
            <p className="text-3xl font-bold font-mono mt-1 text-yellow-400">{stats.skippedPrediction}</p>
          </div>

          <div className="bg-bg-secondary border border-border-default rounded-xl p-4 text-center">
            <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block">Omitidos (No Registrados)</span>
            <p className="text-3xl font-bold font-mono mt-1 text-text-muted">{stats.skippedNotOptedIn}</p>
          </div>
        </div>
      </div>

      {/* Logs Audit Table */}
      <div className="space-y-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-gold-400">
          Historial de Recordatorios Recientes (Últimos 50)
        </h3>

        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-default bg-bg-secondary text-text-secondary font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha/Hora</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Polla</th>
                  <th className="py-3 px-4">Partido</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-muted font-mono">
                      No se han registrado logs de recordatorios todavía.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const localCreatedAt = new Date(log.createdAt).toLocaleString('es-PE', {
                      timeZone: 'America/Lima',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    });

                    return (
                      <tr key={log.id} className="hover:bg-bg-hover/20 transition-all">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-text-secondary">
                          {localCreatedAt}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text-primary">
                            {log.user.displayName || log.user.name}
                          </div>
                          <div className="text-[10px] text-text-muted font-mono">
                            @{log.user.username || 'usuario'} · {maskEmail(log.user.email)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-text-primary font-medium">
                          {log.league.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-text-primary">
                          {log.match.homeTeamCode} vs {log.match.awayTeamCode}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block py-0.5 px-2.5 rounded-full border text-[10px] font-mono font-semibold ${getStatusBadgeClass(log.status)}`}>
                            {getStatusLabel(log.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px] max-w-xs truncate" title={log.errorMessage || log.providerMessageId || ''}>
                          {log.status === 'failed' && (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Error: {log.errorMessage}
                            </span>
                          )}
                          {log.status === 'sent' && (
                            <span className="text-text-muted text-[9px]">
                              ID: {log.providerMessageId}
                            </span>
                          )}
                          {log.status === 'skipped' && (
                            <span className="text-text-muted">
                              Razón: {log.errorMessage}
                            </span>
                          )}
                          {log.status === 'dry_run' && (
                            <span className="text-blue-400">
                              Simulado con éxito
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
