import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { RemindersAdminClient } from './RemindersAdminClient';

export const dynamic = 'force-dynamic';

// Helper to check if email is real
function isRealEmail(email: string): boolean {
  return !!email && !email.endsWith('@polla.local') && email.includes('@');
}

export default async function AdminRemindersPage() {
  const session = await getCurrentSession();
  if (!session || !session.user || !session.user.isSuperadmin) {
    redirect('/');
  }

  // Define local Peru time bounds in UTC
  const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;
  const nowUtc = new Date();
  const nowLima = new Date(nowUtc.getTime() + LIMA_OFFSET_MS);
  
  const startOfTodayUtc = new Date(Date.UTC(nowLima.getUTCFullYear(), nowLima.getUTCMonth(), nowLima.getUTCDate(), 5, 0, 0));
  const endOfTodayUtc = new Date(startOfTodayUtc.getTime() + 24 * 60 * 60 * 1000 - 1000);

  // 1. Stats Queries
  const sentTodayCount = await prisma.reminderLog.count({
    where: {
      status: 'sent',
      createdAt: { gte: startOfTodayUtc, lte: endOfTodayUtc }
    }
  });

  const failedTodayCount = await prisma.reminderLog.count({
    where: {
      status: 'failed',
      createdAt: { gte: startOfTodayUtc, lte: endOfTodayUtc }
    }
  });

  const skippedPredictionTodayCount = await prisma.reminderLog.count({
    where: {
      status: 'skipped',
      errorMessage: 'prediction_exists',
      createdAt: { gte: startOfTodayUtc, lte: endOfTodayUtc }
    }
  });

  // Calculate skipped because not opted in dynamically
  const activeLeagues = await prisma.league.findMany({ where: { status: 'active' } });
  const uniqueMemberIds = new Set<string>();
  const uniqueOptedInIds = new Set<string>();

  for (const l of activeLeagues) {
    const ms = await prisma.leagueMember.findMany({
      where: {
        leagueId: l.id,
        user: { status: 'approved' }
      },
      include: { user: true }
    });
    for (const m of ms) {
      uniqueMemberIds.add(m.userId);
      if (m.user.remindersEnabled && m.user.emailRemindersEnabled && isRealEmail(m.user.email)) {
        uniqueOptedInIds.add(m.userId);
      }
    }
  }
  
  const skippedNotOptedInToday = Math.max(0, uniqueMemberIds.size - uniqueOptedInIds.size);

  // 2. Fetch recent Reminder logs
  const logs = await prisma.reminderLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          displayName: true,
          username: true,
        }
      },
      match: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          kickoffUtc: true,
        }
      },
      league: {
        select: {
          name: true,
        }
      }
    }
  });

  // Serialize logs
  const serializedLogs = logs.map(l => ({
    id: l.id,
    reminderType: l.reminderType,
    channel: l.channel,
    status: l.status,
    sentAt: l.sentAt ? l.sentAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
    provider: l.provider,
    providerMessageId: l.providerMessageId,
    errorMessage: l.errorMessage,
    user: {
      name: l.user.name,
      email: l.user.email,
      displayName: l.user.displayName,
      username: l.user.username,
    },
    match: {
      homeTeamCode: l.match.homeTeamCode,
      awayTeamCode: l.match.awayTeamCode,
      kickoffUtc: l.match.kickoffUtc.toISOString(),
    },
    league: {
      name: l.league.name,
    }
  }));

  // 3. Configurations
  const config = {
    remindersEnabled: process.env.REMINDERS_ENABLED === 'true',
    emailRemindersEnabled: process.env.EMAIL_REMINDERS_ENABLED === 'true',
    hasResendKey: !!process.env.RESEND_API_KEY,
    fromEmail: process.env.EMAIL_FROM || 'La Polla Hipólitos <no-reply@todoestaaca.com>',
  };

  const stats = {
    sent: sentTodayCount,
    failed: failedTodayCount,
    skippedPrediction: skippedPredictionTodayCount,
    skippedNotOptedIn: skippedNotOptedInToday,
  };

  return (
    <RemindersAdminClient
      config={config}
      stats={stats}
      logs={serializedLogs}
    />
  );
}
