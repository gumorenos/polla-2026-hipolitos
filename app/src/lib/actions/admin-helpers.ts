import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export type AdminUserType = 'participant' | 'admin' | 'superadmin';

export type KickoffCorrectionProposal = {
  matchId: string;
  homeTeamCode: string;
  awayTeamCode: string;
  phase: string;
  jornada: string;
  currentKickoffUtc: Date;
  proposedKickoffUtc: Date;
  currentReadable: string;
  proposedReadable: string;
  changed: boolean;
  status: string;
};

export const ownedLeagueSelect = {
  id: true,
  name: true,
  slug: true,
  competitionType: true,
} satisfies Prisma.LeagueSelect;

export const adminUserInclude = Prisma.validator<Prisma.UserInclude>()({
  leaguesOwned: {
    select: ownedLeagueSelect,
  },
  memberships: {
    include: {
      league: {
        select: {
          id: true,
          name: true,
          competitionType: true,
        },
      },
    },
  },
  winnerPredictions: {
    include: {
      league: {
        select: {
          id: true,
          name: true,
          competitionType: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  },
  winnerPredictionHistories: {
    include: {
      league: {
        select: {
          name: true,
          competitionType: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  _count: {
    select: {
      predictions: true,
    },
  },
});

export function getAdminUserTypeFlags(userType: AdminUserType) {
  if (userType === 'superadmin') {
    return { isSuperadmin: true, canCreateLeagues: true };
  }
  if (userType === 'admin') {
    return { isSuperadmin: false, canCreateLeagues: true };
  }
  return { isSuperadmin: false, canCreateLeagues: false };
}

export function parseAdminUserType(userType: string | undefined): AdminUserType | null {
  if (!userType) return 'participant';
  if (userType === 'participant' || userType === 'admin' || userType === 'superadmin') {
    return userType;
  }
  return null;
}

export async function upsertPasswordAccounts(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string,
  hashedPassword: string
) {
  const now = new Date();
  const existingAccounts = await tx.account.findMany({
    where: {
      userId,
      providerId: { in: ['credential', 'email'] },
    },
  });

  const credentialAccount = existingAccounts.find((account) => account.providerId === 'credential');
  if (credentialAccount) {
    await tx.account.update({
      where: { id: credentialAccount.id },
      data: {
        accountId: userId,
        password: hashedPassword,
        updatedAt: now,
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `acc-credential-${randomUUID()}`,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const emailAccount = existingAccounts.find((account) => account.providerId === 'email');
  if (emailAccount) {
    await tx.account.update({
      where: { id: emailAccount.id },
      data: {
        accountId: email,
        password: hashedPassword,
        updatedAt: now,
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `acc-email-${randomUUID()}`,
        accountId: email,
        providerId: 'email',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

export async function syncEmailPasswordAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string
) {
  await tx.account.updateMany({
    where: { userId, providerId: 'email' },
    data: { accountId: email, updatedAt: new Date() },
  });
}

export async function ensureCredentialPasswordAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string
) {
  const existingAccounts = await tx.account.findMany({
    where: {
      userId,
      providerId: { in: ['credential', 'email'] },
    },
  });
  const emailAccount = existingAccounts.find((account) => account.providerId === 'email');
  if (!emailAccount?.password) return;

  const credentialAccount = existingAccounts.find((account) => account.providerId === 'credential');
  if (credentialAccount) {
    await tx.account.update({
      where: { id: credentialAccount.id },
      data: {
        accountId: userId,
        password: emailAccount.password,
        updatedAt: new Date(),
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `acc-credential-${randomUUID()}`,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: emailAccount.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  if (emailAccount.accountId !== email) {
    await tx.account.update({
      where: { id: emailAccount.id },
      data: { accountId: email, updatedAt: new Date() },
    });
  }
}

export async function getAdminUserSnapshot(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: adminUserInclude,
  });
}
