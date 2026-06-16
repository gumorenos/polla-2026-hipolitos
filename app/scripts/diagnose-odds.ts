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
    NODE_ENV: process.env.NODE_ENV,
    ODDS_PRIMARY_PROVIDER: process.env.ODDS_PRIMARY_PROVIDER || 'odds-api-io (default)',
    ODDS_FALLBACK_PROVIDER: process.env.ODDS_FALLBACK_PROVIDER || 'the-odds-api (default)',
    ODDS_API_IO_ENABLED: process.env.ODDS_API_IO_ENABLED,
    THE_ODDS_API_ENABLED: process.env.THE_ODDS_API_ENABLED,
    ODDS_API_IO_SPORT: process.env.ODDS_API_IO_SPORT || 'football (default)',
    ODDS_API_IO_LEAGUE: process.env.ODDS_API_IO_LEAGUE || 'NOT_CONFIGURED',
    ODDS_ALLOW_SIMULATED_DATA: process.env.ODDS_ALLOW_SIMULATED_DATA,
  };

  for (const [k, v] of Object.entries(envVars)) {
    console.log(`${k}: ${v === undefined ? 'UNDEFINED' : `"${v}"`}`);
  }

  const keys = {
    ODDS_API_IO_KEY: process.env.ODDS_API_IO_KEY,
    THE_ODDS_API_KEY: process.env.THE_ODDS_API_KEY,
  };

  for (const [k, v] of Object.entries(keys)) {
    console.log(`${k}: ${maskKey(v)}`);
  }
  console.log('');

  const secretList = [keys.ODDS_API_IO_KEY, keys.THE_ODDS_API_KEY];

  // 2. Count of snapshots by provider from DB
  console.log('--- 2. DB Odds Snapshots Count by Provider ---');
  try {
    const counts = await prisma.oddsSnapshot.groupBy({
      by: ['provider'],
      _count: { _all: true },
    });
    if (counts.length === 0) {
      console.log('No snapshots found in DB.');
    } else {
      counts.forEach((c) => {
        console.log(`- ${c.provider}: ${c._count._all} snapshots`);
      });
    }
  } catch (err) {
    console.error(`Error querying snapshots count: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');

  // 3. Connectivity & Discovery Checks
  console.log('--- 3. External Provider Connectivity & Discovery ---');

  // Odds-API.io Connectivity & Discovery Detail
  if (keys.ODDS_API_IO_KEY && process.env.ODDS_API_IO_ENABLED === 'true') {
    const sport = process.env.ODDS_API_IO_SPORT || 'football';
    const url = `https://api.odds-api.io/v3/leagues?apiKey=${keys.ODDS_API_IO_KEY}&sport=${sport}`;
    console.log(`Checking Odds-API.io leagues endpoint...`);
    console.log(`URL: https://api.odds-api.io/v3/leagues?apiKey=REDACTED&sport=${sport}`);

    interface LeagueInfo {
      name?: string;
      slug?: string;
      id?: string;
    }

    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      console.log(`HTTP Status: ${res.status} ${res.statusText}`);

      if (res.ok) {
        const data = await res.json() as { data?: LeagueInfo[] };
        
        // Log raw response shape summary
        const shapeSummary = data && typeof data === 'object' 
          ? `Object with keys: [${Object.keys(data).join(', ')}]` 
          : typeof data;
        console.log(`Raw Response Shape: ${shapeSummary}`);

        const leagues = data && Array.isArray(data.data) ? data.data : [];
        console.log(`Number of leagues found: ${leagues.length}`);

        // Analyze first 20 candidates
        if (leagues.length > 0) {
          console.log('\nFirst 20 League Candidates:');
          const candidates = leagues.slice(0, 20);
          candidates.forEach((l: LeagueInfo, idx: number) => {
            console.log(`  [${idx + 1}] Name: "${l.name || 'N/A'}", Slug: "${l.slug || 'N/A'}", ID/Key: "${l.id || 'N/A'}"`);
          });

          // Check if any candidate matches World Cup / FIFA / International Football
          const targetKeywords = ['world', 'cup', 'fifa', 'international', 'friendly', 'soccer', 'football'];
          const matchedLeagues = leagues.filter((l: LeagueInfo) => {
            const name = (l.name || '').toLowerCase();
            const slug = (l.slug || '').toLowerCase();
            return targetKeywords.some(k => name.includes(k) || slug.includes(k));
          });

          console.log(`\nMatching target candidates (World Cup/FIFA/International): ${matchedLeagues.length}`);
          matchedLeagues.forEach((l: LeagueInfo) => {
            console.log(`  - Name: "${l.name}", Slug: "${l.slug}"`);
          });
        }
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
  console.log('');

  // The Odds API Connectivity check
  if (keys.THE_ODDS_API_KEY && process.env.THE_ODDS_API_ENABLED === 'true') {
    try {
      const sportKey = process.env.THE_ODDS_API_SPORT_KEY || 'soccer_fifa_world_cup';
      const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${keys.THE_ODDS_API_KEY}`;
      console.log(`Checking The Odds API connectivity and sport: ${sportKey}...`);
      const res = await fetch(url);
      interface TheOddsApiSportInfo {
        key?: string;
      }

      if (res.ok) {
        const data = await res.json() as TheOddsApiSportInfo[];
        if (Array.isArray(data)) {
          const keysList = data.map((s: TheOddsApiSportInfo) => s.key).filter(Boolean);
          const hasSport = keysList.includes(sportKey);
          console.log(`[PASS] The Odds API is CONNECTED. Total sports: ${keysList.length}.`);
          if (hasSport) {
            console.log(`[PASS] Configured sport key "${sportKey}" is AVAILABLE.`);
          } else {
            console.log(`[WARN] Configured sport key "${sportKey}" is NOT active/available.`);
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

  console.log('\n==================================================');
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
