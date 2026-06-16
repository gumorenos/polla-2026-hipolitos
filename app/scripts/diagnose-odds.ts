import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { prisma } from '../src/lib/db';

function maskKey(key?: string): string {
  if (!key) return 'NOT_CONFIGURED';
  if (key.length <= 6) return 'CONFIGURED_BUT_VERY_SHORT';
  return key.slice(0, 3) + '...' + key.slice(-3);
}

function redact(msg: string, keys: (string | undefined)[]): string {
  let out = msg;
  for (const k of keys) {
    if (k && k.length > 3) {
      out = out.split(k).join('REDACTED');
    }
  }
  return out;
}

async function main() {
  console.log('==================================================');
  console.log('   LA POLLA 2026 - ODDS & H2H DIAGNOSTIC SCRIPT   ');
  console.log('==================================================\n');

  // 1. Environment Variables Configuration Check
  console.log('--- 1. Environment Configuration ---');
  const envVars = {
    ODDS_DISPLAY_ENABLED: process.env.ODDS_DISPLAY_ENABLED,
    ODDS_API_IO_ENABLED: process.env.ODDS_API_IO_ENABLED,
    THE_ODDS_API_ENABLED: process.env.THE_ODDS_API_ENABLED,
    API_FOOTBALL_ENABLED: process.env.API_FOOTBALL_ENABLED,
    ODDS_MANUAL_USER_REFRESH_ENABLED: process.env.ODDS_MANUAL_USER_REFRESH_ENABLED,
    ODDS_ALLOW_SIMULATED_DATA: process.env.ODDS_ALLOW_SIMULATED_DATA,
    NODE_ENV: process.env.NODE_ENV,
  };

  for (const [k, v] of Object.entries(envVars)) {
    console.log(`${k}: ${v === undefined ? 'UNDEFINED' : `"${v}"`}`);
  }

  const keys = {
    ODDS_API_IO_KEY: process.env.ODDS_API_IO_KEY,
    THE_ODDS_API_KEY: process.env.THE_ODDS_API_KEY,
    API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY,
  };

  for (const [k, v] of Object.entries(keys)) {
    console.log(`${k}: ${maskKey(v)}`);
  }
  console.log('');

  const secretList = [keys.ODDS_API_IO_KEY, keys.THE_ODDS_API_KEY, keys.API_FOOTBALL_KEY];

  // 2. Connectivity Checks
  console.log('--- 2. External Provider Connectivity ---');

  // Odds-API.io Connectivity
  if (keys.ODDS_API_IO_KEY && process.env.ODDS_API_IO_ENABLED === 'true') {
    try {
      const sport = process.env.ODDS_API_IO_SPORT || 'football';
      const url = `https://api.odds-api.io/v3/leagues?apiKey=${keys.ODDS_API_IO_KEY}&sport=${sport}`;
      console.log(`Checking Odds-API.io connectivity for sport: ${sport}...`);
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const leagues = data && Array.isArray(data.data) ? data.data.map((l: { slug: string }) => l.slug) : [];
        console.log(`[PASS] Odds-API.io is CONNECTED. Found ${leagues.length} leagues.`);
        console.log(`Leagues available (first 10): ${leagues.slice(0, 10).join(', ')}`);
      } else {
        const txt = await res.text().catch(() => '');
        console.error(redact(`[FAIL] Odds-API.io responded with status ${res.status}: ${txt}`, secretList));
      }
    } catch (err) {
      console.error(redact(`[FAIL] Odds-API.io connectivity error: ${err instanceof Error ? err.message : String(err)}`, secretList));
    }
  } else {
    console.log('[WARN] Odds-API.io is disabled or key is missing.');
  }

  // The Odds API Connectivity
  if (keys.THE_ODDS_API_KEY && process.env.THE_ODDS_API_ENABLED === 'true') {
    try {
      const sportKey = process.env.THE_ODDS_API_SPORT_KEY || 'soccer_fifa_world_cup';
      const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${keys.THE_ODDS_API_KEY}`;
      console.log(`Checking The Odds API connectivity and sport: ${sportKey}...`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const keysList = data.map((s: { key: string }) => s.key).filter(Boolean);
          const hasSport = keysList.includes(sportKey);
          console.log(`[PASS] The Odds API is CONNECTED. Total sports: ${keysList.length}.`);
          if (hasSport) {
            console.log(`[PASS] Configured sport key "${sportKey}" is AVAILABLE.`);
          } else {
            console.log(`[WARN] Configured sport key "${sportKey}" is NOT active/available. (It might activate closer to the tournament)`);
          }
        } else {
          console.error('[FAIL] The Odds API response is not an array.');
        }
      } else {
        const txt = await res.text().catch(() => '');
        console.error(redact(`[FAIL] The Odds API responded with status ${res.status}: ${txt}`, secretList));
      }
    } catch (err) {
      console.error(redact(`[FAIL] The Odds API connectivity error: ${err instanceof Error ? err.message : String(err)}`, secretList));
    }
  } else {
    console.log('[WARN] The Odds API is disabled or key is missing.');
  }

  // API-Football Connectivity
  if (keys.API_FOOTBALL_KEY && process.env.API_FOOTBALL_ENABLED === 'true') {
    try {
      const url = 'https://v3.football.api-sports.io/status';
      console.log('Checking API-Football connectivity...');
      const res = await fetch(url, {
        headers: {
          'x-apisports-key': keys.API_FOOTBALL_KEY,
          'Accept': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.response && data.response.account) {
          const acc = data.response.account;
          console.log(`[PASS] API-Football is CONNECTED.`);
          console.log(`Account details: Email: ${acc.email}, Plan: ${acc.firstname} ${acc.lastname}`);
        } else if (data && data.errors && Object.keys(data.errors).length > 0) {
          console.error(redact(`[FAIL] API-Football returned API errors: ${JSON.stringify(data.errors)}`, secretList));
        } else {
          console.log(`[PASS] API-Football is CONNECTED (unexpected status body format).`);
        }
      } else {
        const txt = await res.text().catch(() => '');
        console.error(redact(`[FAIL] API-Football responded with status ${res.status}: ${txt}`, secretList));
      }
    } catch (err) {
      console.error(redact(`[FAIL] API-Football connectivity error: ${err instanceof Error ? err.message : String(err)}`, secretList));
    }
  } else {
    console.log('[WARN] API-Football is disabled or key is missing.');
  }
  console.log('');

  // 3. Database Future Matches Check
  console.log('--- 3. Next 5 Future Matches & Snapshot Status ---');
  try {
    const futureMatches = await prisma.match.findMany({
      where: {
        kickoffUtc: {
          gt: new Date(),
        },
      },
      orderBy: { kickoffUtc: 'asc' },
      take: 5,
    });

    if (futureMatches.length === 0) {
      console.log('No upcoming future matches found in the database.');
    } else {
      for (const m of futureMatches) {
        // Count snapshots
        const oddsCount = await prisma.oddsSnapshot.count({
          where: { matchId: m.id },
        });
        const h2hCount = await prisma.headToHeadSnapshot.count({
          where: { matchId: m.id },
        });

        const kickoffDate = new Date(m.kickoffUtc);
        const limaString = kickoffDate.toLocaleString('es-PE', { timeZone: 'America/Lima' });

        console.log(`Match ${m.id}: ${m.homeTeamCode} vs ${m.awayTeamCode}`);
        console.log(`  Kickoff UTC:  ${kickoffDate.toISOString()}`);
        console.log(`  Kickoff Lima: ${limaString}`);
        console.log(`  Snapshots:    Odds: ${oddsCount}, H2H: ${h2hCount}`);
        console.log('');
      }
    }
  } catch (err) {
    console.error(`Error querying matches: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('==================================================');
  console.log('            DIAGNOSTICS COMPLETE                  ');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('Critical failure in diagnostics:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
