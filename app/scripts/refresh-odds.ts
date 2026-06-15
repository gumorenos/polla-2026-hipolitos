import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { prisma } from '../src/lib/db';
import { getMatchWinnerOdds, saveOddsSnapshot } from '../src/lib/odds/providers';

async function main() {
  console.log('Running refresh-odds script...');

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
    console.log(`Processing single match refresh for match ID: ${targetMatchId}`);
  } else {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find matches kickoff within the next hour and that are open/soon
    matches = await prisma.match.findMany({
      where: {
        kickoffUtc: {
          gte: now,
          lte: oneHourFromNow,
        },
        status: { in: ['open', 'soon'] },
      },
    });
    console.log(`Found ${matches.length} upcoming matches starting in the next hour.`);
  }

  let matchesProcessed = 0;
  let snapshotsCreated = 0;
  let matchesSkipped = 0;
  let errorsCount = 0;
  const providersUsed = new Set<string>();

  for (const match of matches) {
    try {
      matchesProcessed++;
      console.log(`Refreshing odds for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      const odds = await getMatchWinnerOdds(match.id);
      if (!odds) {
        console.log(`No real odds returned by provider for match ${match.id}. Skipping.`);
        matchesSkipped++;
        continue;
      }
      providersUsed.add(odds.provider);
      await saveOddsSnapshot(match.id, odds, { visibility: 'global' });
      snapshotsCreated++;
      console.log(`Successfully saved odds snapshot for ${match.homeTeamCode} vs ${match.awayTeamCode}`);
    } catch (error) {
      errorsCount++;
      console.error(`Error refreshing odds for match ${match.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n--- Refresh Odds Summary ---');
  console.log(`Providers Used:    ${Array.from(providersUsed).join(', ') || 'None'}`);
  console.log(`Matches Processed: ${matchesProcessed}`);
  console.log(`Snapshots Created: ${snapshotsCreated}`);
  console.log(`Matches Skipped:   ${matchesSkipped}`);
  console.log(`Errors Encountered: ${errorsCount}`);
  console.log('----------------------------\n');

  console.log('Finished running refresh-odds script.');
}

main()
  .catch((e) => {
    console.error('Critical failure in refresh-odds:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
