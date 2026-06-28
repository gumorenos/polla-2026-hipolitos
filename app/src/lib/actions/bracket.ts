'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { buildRoundOf32Resolution } from '../knockout-bracket';

type ApplyRoundOf32ResolutionResult =
  | {
      error: string;
      resolution?: ReturnType<typeof buildRoundOf32Resolution>;
    }
  | {
      success: true;
      changed: number;
    };

export async function applyRoundOf32ResolutionAction(): Promise<ApplyRoundOf32ResolutionResult> {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado' };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isSuperadmin) return { error: 'No tienes permisos de superadministrador' };

  const [matches, teams] = await Promise.all([
    prisma.match.findMany({ orderBy: { kickoffUtc: 'asc' } }),
    prisma.team.findMany({ select: { code: true, name: true } }),
  ]);
  const resolution = buildRoundOf32Resolution(matches, teams);
  if (!resolution.canApplySafeProposals) {
    return {
      error: resolution.unresolvedReasons[0] || 'No hay cruces inequívocos pendientes de aplicar.',
      resolution,
    };
  }

  const realTeamCodes = new Set(teams.map((team) => team.code));
  const invalidProposal = resolution.proposals.find((proposal) => (
    !realTeamCodes.has(proposal.resolvedHomeTeamCode)
    || !realTeamCodes.has(proposal.resolvedAwayTeamCode)
  ));
  if (invalidProposal) {
    return { error: `El cruce ${invalidProposal.matchId} contiene una selección que no existe en Team.` };
  }

  const changed = resolution.proposals.filter((proposal) => (
    proposal.currentHomeTeamCode !== proposal.resolvedHomeTeamCode
    || proposal.currentAwayTeamCode !== proposal.resolvedAwayTeamCode
  ));
  await prisma.$transaction(async (tx) => {
    for (const proposal of changed) {
      await tx.match.update({
        where: { id: proposal.matchId },
        data: {
          homeTeamCode: proposal.resolvedHomeTeamCode,
          awayTeamCode: proposal.resolvedAwayTeamCode,
        },
      });
    }
    await tx.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'resolve_round_of_32_bracket',
        target: 'match:r32',
        details: JSON.stringify({ changed: changed.length, proposals: resolution.proposals }),
      },
    });
  });

  revalidatePath('/admin/resultados');
  revalidatePath('/admin/partidos');
  revalidatePath('/pronosticos');
  revalidatePath('/');
  revalidatePath('/invitado');

  return { success: true, changed: changed.length };
}
