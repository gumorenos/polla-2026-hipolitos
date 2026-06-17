import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { AdminChampionClient } from './AdminChampionClient';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Administrar Campeón | La Polla 2026',
};

export default async function AdminChampionPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperadmin) {
    redirect('/competencia');
  }

  // Fetch all winner predictions
  const winnerPredictions = await prisma.winnerPrediction.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true,
          username: true,
        },
      },
      league: {
        select: {
          id: true,
          name: true,
          slug: true,
          championDeadline: true,
          championPoints: true,
        },
      },
      team: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all prediction histories
  const histories = await prisma.winnerPredictionHistory.findMany({
    include: {
      user: {
        select: {
          name: true,
          displayName: true,
          username: true,
        },
      },
      league: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all teams
  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
  });

  // Fetch all leagues
  const leagues = await prisma.league.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  // Fetch all approved users
  const users = await prisma.user.findMany({
    where: { status: 'approved' },
    select: { id: true, name: true, displayName: true, username: true },
  });

  const serializedPredictions = winnerPredictions.map((wp) => ({
    id: wp.id,
    userId: wp.userId,
    userName: wp.user.displayName || wp.user.name,
    userUsername: wp.user.username || null,
    userEmail: wp.user.email,
    leagueId: wp.leagueId,
    leagueName: wp.league.name,
    leagueSlug: wp.league.slug,
    teamCode: wp.teamCode,
    teamName: wp.team.name,
    pointsEarned: wp.pointsEarned,
    createdAt: wp.createdAt.toISOString(),
    updatedAt: wp.updatedAt.toISOString(),
    correctionAllowed: wp.correctionAllowed,
    correctionAllowedUntil: wp.correctionAllowedUntil ? wp.correctionAllowedUntil.toISOString() : null,
    correctionReason: wp.correctionReason,
  }));

  const serializedHistories = histories.map((h) => ({
    id: h.id,
    leagueId: h.leagueId,
    leagueName: h.league.name,
    userId: h.userId,
    userName: h.user.displayName || h.user.name,
    userUsername: h.user.username || null,
    oldTeamCode: h.oldTeamCode,
    newTeamCode: h.newTeamCode,
    actionType: h.actionType,
    authorizedById: h.authorizedById,
    changedById: h.changedById,
    reason: h.reason,
    createdAt: h.createdAt.toISOString(),
  }));

  const serializedTeams = teams.map((t) => ({
    code: t.code,
    name: t.name,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border-subtle pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 hover:bg-bg-hover rounded-xl text-text-secondary hover:text-text-primary transition-all border border-transparent hover:border-border-default"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-wide text-text-primary">CORRECCIÓN DE CAMPEÓN</h2>
            <p className="text-xs text-text-secondary">Monitorea, autoriza correcciones y audita las predicciones de campeón de los usuarios.</p>
          </div>
        </div>
      </div>

      <AdminChampionClient
        predictions={serializedPredictions}
        histories={serializedHistories}
        teams={serializedTeams}
        leagues={leagues}
        users={users}
      />
    </div>
  );
}
