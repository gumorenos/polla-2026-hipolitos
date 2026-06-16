import './load-env';
import { prisma } from '../src/lib/db';
import { Prisma } from '@prisma/client';
import { fetchAndSaveMatchResultInternal } from '../src/lib/actions/results';
import { getProviderCooldown } from '../src/lib/odds/providers';

function isConcreteTeamCode(code: string): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return trimmed.length === 3 && /^[A-Z]{3}$/.test(trimmed);
}

async function main() {
  console.log('==================================================');
  console.log('      LA POLLA 2026 - MATCH RESULTS FETCHER       ');
  console.log('==================================================\n');

  // Diagnostics
  const apiKey = process.env.API_FOOTBALL_KEY;
  const isEnabled = process.env.API_FOOTBALL_ENABLED === 'true';
  console.log(`API-Football Enabled: ${isEnabled ? 'yes' : 'no'}`);
  console.log(`API Key Configured:   ${apiKey ? 'yes' : 'no'}`);
  console.log('');

  // Argument parsing
  const matchIdArg = process.argv.find((arg) => arg.startsWith('--matchId='));
  const targetMatchId = matchIdArg ? matchIdArg.split('=')[1] : null;

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

  const delayArg = process.argv.find((arg) => arg.startsWith('--delayMs='));
  const delayMs = delayArg ? parseInt(delayArg.split('=')[1]) : 3000;

  const dryRun = process.argv.includes('--dryRun') || process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  // Now override for testing
  let now = new Date();
  const nowArg = process.argv.find((arg) => arg.startsWith('--now='));
  if (nowArg) {
    const val = nowArg.split('=')[1];
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      now = parsed;
      console.log(`[NOW OVERRIDE] Simulating current time: ${now.toISOString()}`);
    } else {
      console.error(`[WARN] Invalid --now date value: "${val}". Using system clock.`);
    }
  }

  if (dryRun) {
    console.log('*** DRY RUN MODE ENABLED - No results will be updated in the database ***\n');
  }

  // Cooldown check before calling API
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
    console.log(`Processing single result fetch for match ID: ${targetMatchId}`);
  } else {
    // Find due matches
    const whereClause: Prisma.MatchWhereInput = {};

    if (!force) {
      whereClause.status = { not: 'result' };
    }

    const allUnfinishedMatches = await prisma.match.findMany({
      where: whereClause,
      orderBy: { kickoffUtc: 'asc' },
    });

    // Filter by kickoff delay and concrete team codes
    matches = allUnfinishedMatches.filter((match) => {
      // Must be concrete team codes (no placeholders like W53/RU2)
      if (!isConcreteTeamCode(match.homeTeamCode) || !isConcreteTeamCode(match.awayTeamCode)) {
        return false;
      }

      if (force) {
        return true;
      }

      // Check kickoff delay
      const isGroupStage = match.phase === 'groups';
      const delayMinutes = isGroupStage ? 150 : 210; // 150 mins for group, 210 mins for knockout
      const kickoffTime = new Date(match.kickoffUtc).getTime();
      const cutoffTime = now.getTime() - (delayMinutes * 60 * 1000);

      return kickoffTime <= cutoffTime;
    });

    console.log(`Found ${matches.length} matches due for results. Processing up to ${limit} (force=${force}).`);
    matches = matches.slice(0, limit);
  }

  let checkedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorsCount = 0;

  for (const match of matches) {
    // Check cooldown again inside loop
    const currentCooldown = force ? null : await getProviderCooldown('api-football');
    if (currentCooldown) {
      console.warn(`[ABORT] API-Football entró en cooldown durante la ejecución. Deteniendo script.`);
      break;
    }

    try {
      checkedCount++;
      console.log(`[${checkedCount}/${matches.length}] Checking result for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      
      const res = await fetchAndSaveMatchResultInternal(match.id, { force, dryRun });
      
      if (res.error) {
        console.log(`  -> Skipped/Failed: ${res.error}`);
        skippedCount++;
      } else if (res.success) {
        const r = res.result;
        if (res.dryRun) {
          console.log(`  -> [DRY RUN SUCCESS] Found score: ${r.homeScore}-${r.awayScore} (wentToPenalties: ${r.wentToPenalties})`);
        } else {
          console.log(`  -> [SUCCESS] Applied score: ${r.homeScore}-${r.awayScore} (wentToPenalties: ${r.wentToPenalties})`);
        }
        updatedCount++;
      }

      // Delay to respect API limits if real provider is enabled
      if (isEnabled && checkedCount < matches.length) {
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
      console.error(`Error processing match ${match.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n--- Fetch Results Summary ---');
  console.log(`Matches Checked:    ${checkedCount}`);
  console.log(`Results Updated:    ${updatedCount}`);
  console.log(`Matches Skipped:    ${skippedCount}`);
  console.log(`Errors Encountered: ${errorsCount}`);
  console.log('-----------------------------\n');

  console.log('Finished fetch-results script.');
}

main()
  .catch((e) => {
    console.error('Critical failure in fetch-results:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
