import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { prisma } from '../src/lib/db';
import { Prisma } from '@prisma/client';
import { getMatchWinnerOdds, saveOddsSnapshot, lastOddsError, OddsTracker } from '../src/lib/odds/providers';

async function main() {
  console.log('Running refresh-odds script...');

  // Argument parsing
  const matchIdArg = process.argv.find((arg) => arg.startsWith('--matchId='));
  const targetMatchId = matchIdArg ? matchIdArg.split('=')[1] : null;

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const hoursArg = process.argv.find((arg) => arg.startsWith('--hours='));
  const hours = hoursArg ? parseInt(hoursArg.split('=')[1], 10) : null;

  const bypassCooldown = process.argv.includes('--bypassCooldown') || process.argv.includes('--force');
  const debugMatch = process.argv.includes('--debugMatch');

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
    // Find all matches that are open/soon and filter to only future matches
    const now = new Date();
    const whereClause: Prisma.MatchWhereInput = {
      status: { in: ['open', 'soon'] },
      kickoffUtc: { gt: now }
    };

    if (hours) {
      const maxKickoff = new Date(now.getTime() + hours * 60 * 60 * 1000);
      whereClause.kickoffUtc = {
        gt: now,
        lt: maxKickoff
      };
      console.log(`Filtering matches starting within next ${hours} hours.`);
    }

    const queryOptions: Prisma.MatchFindManyArgs = {
      where: whereClause,
      orderBy: { kickoffUtc: 'asc' },
    };

    if (limit) {
      queryOptions.take = limit;
      console.log(`Limiting to ${limit} matches.`);
    }

    matches = await prisma.match.findMany(queryOptions);
    console.log(`Found ${matches.length} active future matches to refresh.`);
  }

  let matchesProcessed = 0;
  let snapshotsCreated = 0;
  let matchesSkippedCount = 0;
  let errorsCount = 0;

  const tracker: OddsTracker = {
    attempted: new Set<string>(),
    succeeded: new Set<string>(),
    empty: new Map<string, number>(),
    errors: new Map<string, number>(),
  };

  const skippedMatches: { id: string; home: string; away: string; reason: string }[] = [];
  const isStandardTeamCode = (code: string) => /^[A-Z]{3}$/.test(code);

  for (const match of matches) {
    try {
      matchesProcessed++;
      
      // Skip if team codes are bracket placeholders (e.g. 1A, W101)
      if (!isStandardTeamCode(match.homeTeamCode) || !isStandardTeamCode(match.awayTeamCode)) {
        const reason = `One of the team codes is a bracket placeholder.`;
        console.log(`Skipping match ${match.id} (${match.homeTeamCode} vs ${match.awayTeamCode}) because ${reason}`);
        skippedMatches.push({
          id: match.id,
          home: match.homeTeamCode,
          away: match.awayTeamCode,
          reason,
        });
        matchesSkippedCount++;
        continue;
      }

      console.log(`Refreshing odds for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      const odds = await getMatchWinnerOdds(match.id, bypassCooldown, debugMatch, tracker);
      if (!odds) {
        const reason = lastOddsError || "No real odds returned by provider";
        console.log(`No real odds returned by provider for match ${match.id}. Skipping.`);
        skippedMatches.push({
          id: match.id,
          home: match.homeTeamCode,
          away: match.awayTeamCode,
          reason,
        });
        matchesSkippedCount++;
        continue;
      }

      await saveOddsSnapshot(match.id, odds, { visibility: 'global' });
      snapshotsCreated++;
      console.log(`Successfully saved odds snapshot for ${match.homeTeamCode} vs ${match.awayTeamCode} using ${odds.provider}`);
    } catch (error) {
      errorsCount++;
      console.error(`Error refreshing odds for match ${match.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n--- Refresh Odds Summary ---');
  console.log(`Bypass Cooldown:          ${bypassCooldown}`);
  console.log(`Providers Attempted:      ${Array.from(tracker.attempted).join(', ') || 'None'}`);
  console.log(`Providers Succeeded:      ${Array.from(tracker.succeeded).join(', ') || 'None'}`);
  
  console.log('Provider Empty Responses:');
  if (tracker.empty.size === 0) {
    console.log('  None');
  } else {
    for (const [provider, count] of tracker.empty.entries()) {
      console.log(`  - ${provider}: ${count} empty responses`);
    }
  }

  console.log('Provider Errors:');
  if (tracker.errors.size === 0) {
    console.log('  None');
  } else {
    for (const [provider, count] of tracker.errors.entries()) {
      console.log(`  - ${provider}: ${count} errors`);
    }
  }

  console.log(`Snapshots Created:        ${snapshotsCreated}`);
  console.log(`Matches Processed:        ${matchesProcessed}`);
  console.log(`Matches Skipped:          ${matchesSkippedCount}`);
  console.log(`Errors Encountered:       ${errorsCount}`);
  
  console.log('\nMatches Skipped with reason:');
  if (skippedMatches.length === 0) {
    console.log('  None');
  } else {
    skippedMatches.forEach((sm) => {
      console.log(`  - Match ${sm.id} (${sm.home} vs ${sm.away}): ${sm.reason}`);
    });
  }
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
