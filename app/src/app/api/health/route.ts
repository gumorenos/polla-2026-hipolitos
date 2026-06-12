import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connection by executing a simple query
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
