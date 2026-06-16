import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { prisma } from '../src/lib/db';
import { Prisma } from '@prisma/client';
import { getHeadToHeadStats, saveHeadToHeadSnapshot } from '../src/lib/odds/h2h';
import { getProviderCooldown } from '../src/lib/odds/providers';

function isConcreteTeamCode(code: string): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return trimmed.length === 3 && /^[A-Z]{3}$/.test(trimmed);
}

async function main() {
  console.log('Running fetch-h2h script to populate H2H data...');

  // Argument parsing
  const matchIdArg = process.argv.find((arg) => arg.startsWith('--matchId='));
  const targetMatchId = matchIdArg ? matchIdArg.split('=')[1] : null;

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5;

  const delayArg = process.argv.find((arg) => arg.startsWith('--delayMs='));
  const delayMs = delayArg ? parseInt(delayArg.split('=')[1]) : 3000;

  const force = process.argv.includes('--force') || process.argv.includes('--bypassCooldown');

  // Cooldown check before looping
  const initialCooldown = force ? null : await getProviderCooldown('api-football');
  if (initialCooldown) {
    console.warn(`[ABORT] API-Football está en cooldown hasta ${initialCooldown.toISOString()}. Halting execution.`);
    process.exit(0);
  }

  let matches = [];

  if (targetMatchId) {
    const singleMatch = await prisma.match.findUnique({
      where: { id: targetMatchId },
    });
    if (!singleMatch) {
      console.error(`Error: Match with ID ${targetMatchId} not found.`);
      process.exit(1);
    }
    matches = [singleMatch];
    console.log(`Processing single H2H fetch for match ID: ${targetMatchId}`);
  } else {
    // Find future matches
    const now = new Date();
    const whereClause: Prisma.MatchWhereInput = {
      kickoffUtc: { gt: now }
    };
    if (!force) {
      whereClause.h2hSnapshot = {
        is: null
      };
    }

    const matchesList = await prisma.match.findMany({
      where: whereClause,
      orderBy: { kickoffUtc: 'asc' },
    });

    matches = matchesList.slice(0, limit);
    console.log(`Found ${matchesList.length} future matches to check H2H. Processing up to ${limit} (force=${force}).`);
  }

  let matchesProcessed = 0;
  let snapshotsCreated = 0;
  let matchesSkipped = 0;
  let errorsCount = 0;
  const providersUsed = new Set<string>();

  for (const match of matches) {
    if (!isConcreteTeamCode(match.homeTeamCode) || !isConcreteTeamCode(match.awayTeamCode)) {
      console.log(`Skipping match ${match.id} (${match.homeTeamCode} vs ${match.awayTeamCode}) because one or both codes are knockout placeholders.`);
      matchesSkipped++;
      continue;
    }

    // Check cooldown again inside loop (in case it got set during this run)
    const currentCooldown = force ? null : await getProviderCooldown('api-football');
    if (currentCooldown) {
      console.warn(`[ABORT] API-Football entró en cooldown durante la ejecución. Deteniendo script.`);
      break;
    }

    try {
      matchesProcessed++;
      console.log(`Fetching H2H for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      const stats = await getHeadToHeadStats(match.id, force);
      if (!stats) {
        console.log(`No real H2H data returned by provider for match ${match.id}. Skipping.`);
        matchesSkipped++;
        continue;
      }
      providersUsed.add(stats.provider);
      await saveHeadToHeadSnapshot(match.id, stats);
      snapshotsCreated++;
      console.log(`Successfully saved H2H for match ${match.id} using ${stats.provider}`);
      
      // Delay to respect API limits if real provider is enabled
      if (process.env.API_FOOTBALL_ENABLED === 'true') {
        console.log(`Waiting ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        console.error(`\n[CRITICAL] API-Football Rate Limit (429) encountered. Halting script execution immediately.`);
        errorsCount++;
        break; // Stop loop immediately to prevent further requests
      }
      errorsCount++;
      console.error(`Error fetching H2H for match ${match.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n--- Fetch H2H Summary ---');
  console.log(`Providers Used:    ${Array.from(providersUsed).join(', ') || 'None'}`);
  console.log(`Matches Processed: ${matchesProcessed}`);
  console.log(`Snapshots Created: ${snapshotsCreated}`);
  console.log(`Matches Skipped:   ${matchesSkipped}`);
  console.log(`Errors Encountered: ${errorsCount}`);
  console.log('-------------------------\n');

  console.log('Finished fetch-h2h script.');
}

main()
  .catch((e) => {
    console.error('Critical failure in fetch-h2h:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
