'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '../auth-helpers';
import { prisma } from '../db';
import { normalizeTeamAlias } from '../team-alias';
import { seedDefaultTeamAliases } from '../team-alias-service';

type TeamAliasActionResult = {
  success: boolean;
  message: string;
};

async function getSuperadminUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isSuperadmin: true },
  });
  return user?.isSuperadmin ? user.id : null;
}

export async function seedSuggestedTeamAliasesAction(): Promise<TeamAliasActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const created = await seedDefaultTeamAliases(userId);
  revalidatePath('/admin/odds');
  return {
    success: true,
    message: created > 0
      ? `Se crearon ${created} aliases sugeridos.`
      : 'Los aliases sugeridos ya estaban actualizados.',
  };
}

export async function linkProviderTeamOutcomeAction(
  outcomeId: string,
  teamCode: string,
): Promise<TeamAliasActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const [outcome, team] = await Promise.all([
    prisma.providerTeamOutcome.findUnique({ where: { id: outcomeId } }),
    prisma.team.findUnique({ where: { code: teamCode }, select: { code: true } }),
  ]);
  if (!outcome || !team) {
    return { success: false, message: 'Resultado o equipo no encontrado.' };
  }

  const normalizedAlias = outcome.normalizedName || normalizeTeamAlias(outcome.rawName);

  await prisma.$transaction([
    prisma.teamAlias.upsert({
      where: {
        provider_normalizedAlias: { provider: outcome.provider, normalizedAlias },
      },
      create: {
        teamCode: team.code,
        provider: outcome.provider,
        alias: outcome.rawName,
        normalizedAlias,
        confidence: 1,
        source: 'manual',
        createdByUserId: userId,
      },
      update: {
        teamCode: team.code,
        alias: outcome.rawName,
        normalizedAlias,
        confidence: 1,
        source: 'manual',
        createdByUserId: userId,
      },
    }),
    prisma.providerTeamOutcome.update({
      where: { id: outcome.id },
      data: {
        suggestedTeamCode: team.code,
        confidence: 1,
        reason: 'Alias vinculado manualmente por un superadministrador.',
        status: 'matched',
        lastSeenAt: new Date(),
      },
    }),
  ]);

  revalidatePath('/admin/odds');
  return { success: true, message: `Alias vinculado a ${team.code}.` };
}

export async function ignoreProviderTeamOutcomeAction(
  outcomeId: string,
): Promise<TeamAliasActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const updated = await prisma.providerTeamOutcome.updateMany({
    where: { id: outcomeId },
    data: {
      status: 'ignored',
      reason: 'Ignorado manualmente por un superadministrador.',
    },
  });
  if (updated.count === 0) {
    return { success: false, message: 'Nombre de proveedor no encontrado.' };
  }
  revalidatePath('/admin/odds');
  return { success: true, message: 'Nombre ignorado.' };
}
