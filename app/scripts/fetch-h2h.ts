import { prisma } from '../src/lib/db';
import { getHeadToHeadStats, saveHeadToHeadSnapshot } from '../src/lib/odds/h2h';

async function main() {
  console.log('Running fetch-h2h script to populate missing H2H data...');

  const matches = await prisma.match.findMany({
    where: {
      h2hSnapshot: null,
    },
  });

  console.log(`Found ${matches.length} matches missing H2H snapshots.`);

  for (const match of matches) {
    try {
      console.log(`Fetching H2H for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      const stats = await getHeadToHeadStats(match.id);
      await saveHeadToHeadSnapshot(match.id, stats);
      console.log(`Successfully saved H2H for match ${match.id}`);
      
      // Delay to respect API limits if real provider is enabled
      if (process.env.API_FOOTBALL_ENABLED === 'true') {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error fetching H2H for match ${match.id}:`, error);
    }
  }

  console.log('Finished fetch-h2h script.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
