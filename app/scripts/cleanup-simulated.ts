import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { prisma } from '../src/lib/db';

async function main() {
  console.log('Running cleanup-simulated script...');

  // 1. Delete simulated odds snapshots
  const deletedOdds = await prisma.oddsSnapshot.deleteMany({
    where: {
      OR: [
        { provider: 'simulator' },
        { bookmaker: 'LaPolla 2026 Simulator' },
        { rawPayload: { contains: 'simulated=true' } },
        { rawPayload: { contains: '"simulated":true' } },
      ],
    },
  });

  console.log(`Deleted ${deletedOdds.count} simulated odds snapshots.`);

  // 2. Delete simulated H2H snapshots
  const deletedH2h = await prisma.headToHeadSnapshot.deleteMany({
    where: {
      provider: 'simulator',
    },
  });

  console.log(`Deleted ${deletedH2h.count} simulated H2H snapshots.`);
}

main()
  .catch((e) => {
    console.error('Error during simulated data cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
