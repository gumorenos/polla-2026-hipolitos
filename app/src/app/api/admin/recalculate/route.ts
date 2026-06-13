import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '../../../../lib/auth-helpers';
import { prisma } from '../../../../lib/db';
import { recalculateAllStandings } from '../../../../lib/actions/admin';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isSuperadmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    await recalculateAllStandings();

    // Add audit log
    await prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'ranking_recalculation',
        target: 'all_leagues',
        details: 'Manual standings recalculation triggered from admin page.',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recalculating standings:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
