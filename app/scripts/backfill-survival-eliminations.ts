/**
 * app/scripts/backfill-survival-eliminations.ts
 *
 * Script to backfill missing `eliminatedInMatchId` for teams that have status = 'eliminated'
 * but no match ID registered.
 *
 * Execute with:
 *   npx tsx scripts/backfill-survival-eliminations.ts
 */

import './load-env';
import { prisma } from '../src/lib/db';
import { deriveSurvivalEliminationMatchId } from '../src/lib/champion-survivor';

async function main() {
  console.log('--- Iniciando backfill de eliminación de supervivientes ---');

  // 1. Fetch all team tournament statuses that are eliminated but don't have eliminatedInMatchId
  const targets = await prisma.teamTournamentStatus.findMany({
    where: {
      status: 'eliminated',
      OR: [
        { eliminatedInMatchId: null },
        { eliminatedInMatchId: '' },
      ],
    },
  });

  if (targets.length === 0) {
    console.log('No se encontraron registros de equipos eliminados sin ID de partido.');
    return;
  }

  console.log(`Se encontraron ${targets.length} registros para procesar.`);

  // 2. Fetch all matches to derive from
  const matches = await prisma.match.findMany({
    select: {
      id: true,
      phase: true,
      homeTeamCode: true,
      awayTeamCode: true,
      winnerTeamCode: true,
    },
  });

  let updatedCount = 0;

  for (const target of targets) {
    const derivedMatchId = deriveSurvivalEliminationMatchId(target.teamCode, matches);
    if (derivedMatchId) {
      console.log(`Derivado: Equipo ${target.teamCode} (Liga ${target.leagueId}) eliminado en el partido ${derivedMatchId}`);
      await prisma.teamTournamentStatus.update({
        where: { id: target.id },
        data: { eliminatedInMatchId: derivedMatchId },
      });
      updatedCount++;
    } else {
      console.log(`No se pudo derivar partido para equipo ${target.teamCode} (Liga ${target.leagueId})`);
    }
  }

  console.log(`--- Fin de backfill: ${updatedCount} registros actualizados de forma exitosa ---`);
}

main()
  .catch((err) => {
    console.error('Error durante el backfill:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
