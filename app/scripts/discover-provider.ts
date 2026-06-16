import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

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
  console.log('      LA POLLA 2026 - PROVIDER DISCOVERY          ');
  console.log('==================================================\n');

  const providerArg = process.argv.find((arg) => arg.startsWith('--provider='));
  const provider = providerArg ? providerArg.split('=')[1] : 'odds-api-io';

  if (provider !== 'odds-api-io') {
    console.error(`Error: Provider "${provider}" is not supported for discovery script. Use --provider=odds-api-io.`);
    process.exit(1);
  }

  const apiKey = process.env.ODDS_API_IO_KEY;
  if (!apiKey) {
    console.error('Error: ODDS_API_IO_KEY is not defined in the environment.');
    process.exit(1);
  }

  console.log(`Target Provider:  ${provider}`);
  console.log(`API Key:          ${maskKey(apiKey)}`);
  console.log('');

  // Candidate sports to test
  // Also includes undefined to test calling without the sport parameter
  const sportCandidates = ['football', 'soccer', 'international', 'worldcup', undefined];

  for (const sport of sportCandidates) {
    const sportLabel = sport === undefined ? 'OMITTED (All Sports)' : `"${sport}"`;
    console.log(`--- Testing sport candidate: ${sportLabel} ---`);

    const queryParams = new URLSearchParams();
    queryParams.set('apiKey', apiKey);
    if (sport !== undefined) {
      queryParams.set('sport', sport);
    }

    const url = `https://api.odds-api.io/v3/leagues?${queryParams.toString()}`;
    const cleanUrl = `https://api.odds-api.io/v3/leagues?apiKey=REDACTED${sport !== undefined ? `&sport=${sport}` : ''}`;
    console.log(`Calling: ${cleanUrl}`);

    interface LeagueInfo {
      name?: string;
      slug?: string;
      id?: string;
    }

    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      console.log(`HTTP Status: ${res.status} ${res.statusText}`);

      const responseText = await res.text().catch(() => '');
      let data: { data?: LeagueInfo[] } | null = null;
      try {
        data = JSON.parse(responseText) as { data?: LeagueInfo[] };
      } catch {
        // Not JSON
      }

      if (data && typeof data === 'object') {
        const keysList = Object.keys(data);
        console.log(`Response Shape: Object with keys [${keysList.join(', ')}]`);
        
        if (Array.isArray(data.data)) {
          const leagues = data.data;
          console.log(`Number of leagues/records found: ${leagues.length}`);
          
          if (leagues.length > 0) {
            console.log(`First 20 Candidates:`);
            leagues.slice(0, 20).forEach((l: LeagueInfo, idx: number) => {
              console.log(`  [${idx + 1}] Name: "${l.name || 'N/A'}", Slug: "${l.slug || 'N/A'}", ID/Key: "${l.id || 'N/A'}"`);
            });

            // Look for matching targets
            const targetKeywords = ['world', 'cup', 'fifa', 'international', 'friendly', 'soccer', 'football'];
            const matches = leagues.filter((l: LeagueInfo) => {
              const name = (l.name || '').toLowerCase();
              const slug = (l.slug || '').toLowerCase();
              return targetKeywords.some(k => name.includes(k) || slug.includes(k));
            });

            if (matches.length > 0) {
              console.log(`\nRecommended Configurations Found:`);
              matches.forEach((l: LeagueInfo) => {
                console.log(`  - League Name: "${l.name}"`);
                console.log(`    Suggested ENV variables:`);
                console.log(`      ODDS_API_IO_SPORT="${sport || 'football'}"`);
                console.log(`      ODDS_API_IO_LEAGUE="${l.slug || l.id || ''}"`);
              });
            }
          }
        } else {
          console.log('Warning: Response "data" property is not an array.');
        }
      } else {
        console.log(`Response Shape: Raw Text (${responseText.length} bytes)`);
        if (responseText) {
          console.log(`Raw Snippet: ${redact(responseText.slice(0, 300), [apiKey])}`);
        }
      }
    } catch (err) {
      console.error(redact(`Error testing candidate ${sportLabel}: ${err instanceof Error ? err.message : String(err)}`, [apiKey]));
    }
    console.log('');
  }

  console.log('==================================================');
  console.log('            DISCOVERY COMPLETE                    ');
  console.log('==================================================');
}

main().catch((e) => {
  console.error('Critical failure in discovery:', e);
  process.exit(1);
});
