'use client';

import React, { useState } from 'react';
import { AppShell } from '../layout/AppShell';
import { Users, DollarSign, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { joinLeagueAction } from '../../lib/actions/leagues';

interface JoinLeagueClientProps {
  league: {
    id: string;
    name: string;
    slug: string;
    inviteCode: string;
    memberCount: number;
  } | null;
  isAlreadyMember: boolean;
  inviteCode: string;
}

export const JoinLeagueClient: React.FC<JoinLeagueClientProps> = ({
  league,
  isAlreadyMember,
  inviteCode,
}) => {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!league) return;
    setJoining(true);
    setErrorMsg(null);

    const result = await joinLeagueAction(league.inviteCode);
    if (result.error) {
      setErrorMsg(result.error);
      setJoining(false);
    } else {
      router.push(`/liga/${result.slug}`);
      router.refresh();
    }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto pt-8">
        {errorMsg && (
          <div className="mb-4 text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {league ? (
          isAlreadyMember ? (
            <div className="card-base p-6 border-border-active space-y-4 text-center">
              <h2 className="font-display text-2xl text-gold-400 uppercase">Ya eres miembro</h2>
              <p className="text-xs text-text-secondary">
                Ya perteneces a la liga privada <strong className="text-text-primary">{league.name}</strong>. Puedes ingresar directamente para ver las clasificaciones y registrar predicciones.
              </p>
              <div className="pt-2">
                <Link
                  href={`/liga/${league.slug}`}
                  className="btn-gold text-xs py-2.5 px-5 inline-flex items-center gap-1.5"
                >
                  Ir a la Liga <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="card-base p-6 border-border-active space-y-6 relative overflow-hidden bg-bg-tertiary/80 backdrop-blur-md">
              {/* Top gold glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gold-400/5 blur-[50px] pointer-events-none" />

              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-gold-400 font-mono tracking-widest uppercase font-semibold">
                    Invitación Recibida
                  </span>
                  <h2 className="font-display text-2xl tracking-wide text-text-primary mt-0.5 uppercase">
                    Te invitaron a unirte
                  </h2>
                </div>
              </div>

              {/* League Details Card */}
              <div className="bg-bg-secondary p-4 rounded-xl border border-border-default space-y-3">
                <h3 className="font-bold text-center text-text-primary text-base">{league.name}</h3>
                <div className="flex justify-around text-xs text-text-secondary border-t border-border-subtle pt-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-text-muted uppercase text-[9px] font-mono">Miembros</span>
                    <span className="flex items-center gap-1 font-bold text-text-primary">
                      <Users className="w-3.5 h-3.5 text-gold-400" /> {league.memberCount}
                    </span>
                  </div>
                  <div className="w-[1px] bg-border-subtle" />
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-text-muted uppercase text-[9px] font-mono">Premio Pot</span>
                    <span className="flex items-center gap-1 font-bold text-text-primary">
                      <DollarSign className="w-3.5 h-3.5 text-gold-400" /> $0
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-text-secondary text-center leading-relaxed">
                Al unirte a esta liga podrás registrar tus predicciones para todos los partidos y competir en la tabla de clasificación.
              </p>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full btn-gold py-3 text-md flex items-center justify-center gap-1.5"
                >
                  {joining ? 'Uniéndose...' : 'Aceptar Invitación'}
                </button>
                <Link href="/liga" className="w-full btn-ghost py-2.5 text-center text-xs">
                  Rechazar y salir
                </Link>
              </div>
            </div>
          )
        ) : (
          <div className="card-base p-6 border-border-active space-y-4 text-center">
            <h2 className="font-display text-2xl text-rank-down uppercase">Código Inválido</h2>
            <p className="text-xs text-text-secondary">
              No pudimos encontrar ninguna liga privada activa asociada al código de invitación{' '}
              <code className="font-mono text-gold-400 font-bold bg-bg-secondary px-2 py-0.5 rounded border border-border-default">
                {inviteCode}
              </code>
              .
            </p>
            <div className="pt-2">
              <Link href="/liga" className="btn-gold text-xs py-2 px-4 inline-flex items-center gap-1.5">
                Volver a ligas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
