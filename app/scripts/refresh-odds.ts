import { prisma } from '../src/lib/db';
import { getMatchWinnerOdds, saveOddsSnapshot } from '../src/lib/odds/providers';

async function main() {
  console.log('Running refresh-odds script...');
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  // Find matches kickoff within the next hour and that are open/soon
  const matches = await prisma.match.findMany({
    where: {
      kickoffUtc: {
        gte: now,
        lte: oneHourFromNow,
      },
      status: { in: ['open', 'soon'] },
    },
  });

  console.log(`Found ${matches.length} upcoming matches starting in the next hour.`);

  for (const match of matches) {
    try {
      console.log(`Refreshing odds for match ${match.id}: ${match.homeTeamCode} vs ${match.awayTeamCode}`);
      const odds = await getMatchWinnerOdds(match.id);
      await saveOddsSnapshot(match.id, odds, { visibility: 'global' });
      console.log(`Successfully saved odds snapshot for ${match.homeTeamCode} vs ${match.awayTeamCode}`);
    } catch (error) {
      console.error(`Error refreshing odds for match ${match.id}:`, error);
    }
  }

  console.log('Finished running refresh-odds script.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
