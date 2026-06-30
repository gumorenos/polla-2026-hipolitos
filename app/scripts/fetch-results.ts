import './load-env';
import { prisma } from '../src/lib/db';
import { Prisma } from '@prisma/client';
import { fetchAndSaveMatchResultInternal } from '../src/lib/actions/results';
import { getProviderCooldown } from '../src/lib/odds/providers';
import { resolveProviderApiKey } from '../src/lib/provider-credentials';
import { parseResultFetchMatchId } from '../src/lib/result-fetch-cli';
import type { ProviderResultDetails } from '../src/lib/odds/football-data';

function logResultDetails(result: ProviderResultDetails, provider: string, isFallback: boolean) {
  console.log(`     homeScore=${result.homeScore}`);
  console.log(`     awayScore=${result.awayScore}`);
  console.log(`     wentToExtraTime=${result.wentToExtraTime}`);
  console.log(`     wentToPenalties=${result.wentToPenalties}`);
  console.log(`     homePenaltyScore=${result.homePenaltyScore ?? 'null'}`);
  console.log(`     awayPenaltyScore=${result.awayPenaltyScore ?? 'null'}`);
  console.log(`     winnerTeamCode=${result.winnerTeamCode ?? 'null'}`);
  console.log(`     provider=${provider}`);
  console.log(`     fallback=${isFallback ? 'yes' : 'no'}`);
  if (result.normalizationNote) console.log(`     note=${result.normalizationNote}`);
}

function isConcreteTeamCode(code: string): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return trimmed.length === 3 && /^[A-Z]{3}$/.test(trimmed);
}

async function main() {
  console.log('==================================================');
  console.log('      LA POLLA 2026 - MATCH RESULTS FETCHER       ');
  console.log('==================================================\n');

  // Diagnostics (never log API keys)
  const apiFootballCredential = await resolveProviderApiKey('api-football');
  const footballDataCredential = await resolveProviderApiKey('football-data');
  const resultsFetchEnabled = process.env.RESULTS_FETCH_ENABLED !== 'false';

  console.log(`RESULTS_FETCH_ENABLED:   ${resultsFetchEnabled ? 'yes' : 'no (usa --dryRun para testear de todas formas)'}`);
  console.log(`API-Football Configured: ${apiFootballCredential.configured ? `yes (${apiFootballCredential.source})` : 'no'}`);
  console.log(`Football-Data Configured:${footballDataCredential.configured ? ` yes (${footballDataCredential.source})` : ' no'}`);
  console.log(`RESULTS_PROVIDER_CHAIN:  ${process.env.RESULTS_PROVIDER_CHAIN ?? 'api-football,football-data'}`);
  console.log('');

  // Argument parsing
  const targetMatchId = parseResultFetchMatchId(process.argv.slice(2));

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

  const delayArg = process.argv.find((arg) => arg.startsWith('--delayMs='));
  const delayMs = delayArg ? parseInt(delayArg.split('=')[1]) : 3000;

  const dryRun = process.argv.includes('--dryRun') || process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const providerArg = process.argv.find((arg) => arg.startsWith('--provider='));
  const provider = providerArg ? providerArg.split('=')[1] : 'auto';

  const dateArg = process.argv.find((arg) => arg.startsWith('--date='));
  const targetDate = dateArg ? dateArg.split('=')[1] : null;

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

  // Respect RESULTS_FETCH_ENABLED unless dryRun or --force
  if (!resultsFetchEnabled && !dryRun && !force) {
    console.log('[INFO] RESULTS_FETCH_ENABLED=false — abortando. Usa --dryRun para simular, o establece RESULTS_FETCH_ENABLED=true.');
    process.exit(0);
  }

  console.log(`Provider mode: ${provider}`);
  if (targetDate) console.log(`Target date filter: ${targetDate}`);
  console.log('');

  // Cooldown checks (per primary provider)
  if (provider === 'auto' || provider === 'api-football') {
    const initialCooldown = force ? null : await getProviderCooldown('api-football');
    if (initialCooldown && provider === 'api-football') {
      console.warn(`[ABORT] API-Football en cooldown hasta ${initialCooldown.toISOString()}. No hay fallback disponible en modo api-football.`);
      process.exit(0);
    }
    if (initialCooldown) {
      console.warn(`[WARN] API-Football en cooldown hasta ${initialCooldown.toISOString()}. Se usará fallback (football-data).`);
    }
  }

  let matches = [];

  if (targetMatchId) {
    const singleMatch = await prisma.match.findUnique({ where: { id: targetMatchId } });
    if (!singleMatch) {
      console.error(`Error: Partido con ID ${targetMatchId} no encontrado.`);
      process.exit(1);
    }
    matches = [singleMatch];
    console.log(`Procesando partido único ID: ${targetMatchId}`);
  } else {
    const whereClause: Prisma.MatchWhereInput = {};
    if (!force) {
      whereClause.OR = [
        { status: { not: 'result' } },
        { homeScore: null },
        { awayScore: null },
        { resultStatus: { not: 'final' } },
      ];
    }

    let allUnfinishedMatches = await prisma.match.findMany({
      where: whereClause,
      orderBy: { kickoffUtc: 'asc' },
    });

    // Filter by target date if specified
    if (targetDate) {
      allUnfinishedMatches = allUnfinishedMatches.filter((match) => {
        const matchDate = new Date(match.kickoffUtc).toISOString().slice(0, 10);
        return matchDate === targetDate;
      });
      console.log(`Filtrado por fecha ${targetDate}: ${allUnfinishedMatches.length} partidos`);
    }

    // Filter by kickoff delay and concrete team codes
    matches = allUnfinishedMatches.filter((match) => {
      if (!isConcreteTeamCode(match.homeTeamCode) || !isConcreteTeamCode(match.awayTeamCode)) {
        return false;
      }
      if (force) return true;

      const isGroupStage = match.phase === 'groups';
      const delayMinutes = isGroupStage
        ? parseInt(process.env.RESULTS_FETCH_DELAY_MINUTES_GROUPS ?? '150')
        : parseInt(process.env.RESULTS_FETCH_DELAY_MINUTES_KNOCKOUT ?? '210');
      const kickoffTime = new Date(match.kickoffUtc).getTime();
      const cutoffTime = now.getTime() - (delayMinutes * 60 * 1000);

      return kickoffTime <= cutoffTime;
    });

    console.log(`Encontrados ${matches.length} partidos listos. Procesando hasta ${limit} (force=${force}).`);
    matches = matches.slice(0, limit);
  }

  let checkedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorsCount = 0;
  let fallbackCount = 0;

  for (const match of matches) {
    // Check cooldown again inside loop (only for api-football)
    if (provider === 'auto' || provider === 'api-football') {
      const currentCooldown = force ? null : await getProviderCooldown('api-football');
      if (currentCooldown && provider === 'api-football') {
        console.warn(`[ABORT] API-Football entró en cooldown. Deteniendo script.`);
        break;
      }
    }

    try {
      checkedCount++;
      console.log(`[${checkedCount}/${matches.length}] ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);

      const res = await fetchAndSaveMatchResultInternal(match.id, { force, dryRun, provider });

      if ('error' in res && res.error) {
        console.log(`  -> Skipped/Failed: ${res.error}`);
        if ('result' in res && res.result) {
          logResultDetails(res.result, res.usedProvider ?? 'unknown', Boolean(res.isFallback));
        }
        if (res.diagnostics) {
          res.diagnostics.forEach(d => {
            console.log(`     [${d.provider}] ${d.success ? 'OK' : d.errorMessage ?? 'error'}`);
            if (d.scoreSummary) console.log(`       ${d.scoreSummary}`);
          });
        }
        skippedCount++;
      } else if ('success' in res && res.success) {
        const r = res.result;
        const providerUsed = res.usedProvider ?? 'unknown';
        if (!r) {
          console.log('  -> Skipped/Failed: El proveedor no devolvió detalles del resultado.');
          skippedCount++;
          continue;
        }
        console.log(`  -> [${res.dryRun ? 'DRY RUN' : 'SUCCESS'}]`);
        logResultDetails(r, providerUsed, Boolean(res.isFallback));
        if (res.diagnostics) {
          res.diagnostics.forEach(d => {
            console.log(`     diagnostic[${d.provider}]=${d.success ? 'OK' : d.errorMessage ?? 'error'}`);
            if (d.scoreSummary) console.log(`       ${d.scoreSummary}`);
          });
        }
        if (res.isFallback) fallbackCount++;
        updatedCount++;
      }

      if (checkedCount < matches.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        console.error(`\n[CRITICAL] Rate limit (429) encontrado. Deteniendo script.`);
        errorsCount++;
        break;
      }
      errorsCount++;
      console.error(`Error procesando ${match.id}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n--- Resumen ---');
  console.log(`Partidos revisados: ${checkedCount}`);
  console.log(`Resultados ${dryRun ? 'encontrados (dry run)' : 'aplicados'}: ${updatedCount}`);
  if (fallbackCount > 0) console.log(`Vía fallback: ${fallbackCount}`);
  console.log(`Omitidos:           ${skippedCount}`);
  console.log(`Errores:            ${errorsCount}`);
  console.log('---------------\n');
}

main()
  .catch((e) => {
    console.error('Error crítico en fetch-results:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
