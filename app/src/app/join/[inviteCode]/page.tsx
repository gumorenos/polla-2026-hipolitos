'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/AppShell';
import { MOCK_LEAGUES } from '../../../lib/mockData';
import { useParams, useRouter } from 'next/navigation';
import { Users, DollarSign, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function JoinLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.inviteCode as string;
  const [joining, setJoining] = useState(false);

  const league = MOCK_LEAGUES.find(
    (l) => l.inviteCode.toUpperCase() === inviteCode.toUpperCase()
  );

  const handleJoin = () => {
    setJoining(true);
    setTimeout(() => {
      // Navigate to the league detail page
      if (league) {
        router.push(`/liga/${league.slug}`);
      } else {
        router.push('/liga');
      }
    }, 1000);
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto pt-8">
        {league ? (
          <div className="card-base p-6 border-border-active space-y-6 relative overflow-hidden bg-bg-tertiary/80 backdrop-blur-md">
            {/* Top gold glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gold-400/5 blur-[50px] pointer-events-none" />

            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gold-400 font-mono tracking-widest uppercase font-semibold">Invitación Recibida</span>
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
                    <Users className="w-3.5 h-3.5 text-gold-400" /> 5
                  </span>
                </div>
                <div className="w-[1px] bg-border-subtle" />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-text-muted uppercase text-[9px] font-mono">Premio Pot</span>
                  <span className="flex items-center gap-1 font-bold text-text-primary">
                    <DollarSign className="w-3.5 h-3.5 text-gold-400" /> ${league.pot}
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
        ) : (
          <div className="card-base p-6 border-border-active space-y-4 text-center">
            <h2 className="font-display text-2xl text-rank-down uppercase">Código Inválido</h2>
            <p className="text-xs text-text-secondary">
              No pudimos encontrar ninguna liga privada activa asociada al código de invitación <code className="font-mono text-gold-400 font-bold bg-bg-secondary px-2 py-0.5 rounded border border-border-default">{inviteCode}</code>.
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
}
