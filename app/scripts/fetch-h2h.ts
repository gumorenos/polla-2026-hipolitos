import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { prisma } from '../src/lib/db';
import { getHeadToHeadStats, saveHeadToHeadSnapshot } from '../src/lib/odds/h2h';

async function main() {
  console.log('Running fetch-h2h script to populate H2H data...');

  // Argument parsing
  const matchIdArg = process.argv.find((arg) => arg.startsWith('--matchId='));
  const targetMatchId = matchIdArg ? matchIdArg.split('=')[1] : null;

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
    // Find matches that do not have a HeadToHeadSnapshot and filter to only future matches
    const missingH2h = await prisma.match.findMany({
      where: {
        h2hSnapshot: null,
      },
      orderBy: { kickoffUtc: 'asc' },
    });
    const now = new Date();
    matches = missingH2h.filter(m => new Date(m.kickoffUtc) > now);
    console.log(`Found ${matches.length} future matches missing H2H snapshots.`);
  }

  let matchesProcessed = 0;
  let snapshotsCreated = 0;
  let matchesSkipped = 0;
  let errorsCount = 0;
  const providersUsed = new Set<string>();

  for (const match of matches) {
    try {
      matchesProcessed++;
      console.log(`Fetching H2H for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      const stats = await getHeadToHeadStats(match.id);
      if (!stats) {
        console.log(`No real H2H data returned by provider for match ${match.id}. Skipping.`);
        matchesSkipped++;
        continue;
      }
      providersUsed.add(stats.provider);
      await saveHeadToHeadSnapshot(match.id, stats);
      snapshotsCreated++;
      console.log(`Successfully saved H2H for match ${match.id}`);
      
      // Delay to respect API limits if real provider is enabled
      if (process.env.API_FOOTBALL_ENABLED === 'true') {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
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
