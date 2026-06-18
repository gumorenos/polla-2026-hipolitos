import { redirect } from 'next/navigation';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
export const dynamic = "force-dynamic";
import UsersAdminClient from './UsersAdminClient';
import Link from 'next/link';

export const metadata = {
  title: 'Admin - Gestión de Usuarios | La Polla 2026',
};

export default async function AdminUsuariosPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isSuperadmin) {
    redirect('/competencia');
  }

  const users = await prisma.user.findMany({
    include: {
      leaguesOwned: {
        select: {
          id: true,
          name: true,
          slug: true,
          competitionType: true,
        },
      },
      memberships: {
        include: {
          league: {
            select: {
              id: true,
              name: true,
              competitionType: true,
            },
          },
        },
      },
      winnerPredictions: {
        include: {
          league: {
            select: {
              id: true,
              name: true,
              competitionType: true,
            }
          },
          team: {
            select: {
              name: true,
            }
          }
        }
      },
      winnerPredictionHistories: {
        include: {
          league: {
            select: {
              name: true,
              competitionType: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        }
      },
      _count: {
        select: {
          predictions: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeLeagues = await prisma.league.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      competitionType: true,
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gold">Gestión de Usuarios</h1>
        <Link href="/admin" className="text-sm text-gold hover:underline">
          &larr; Volver a Panel
        </Link>
      </div>
      
      <div className="bg-surface border border-border rounded-lg p-6">
        <p className="text-text-muted mb-6">
          Promueve usuarios a Superadmin globales o retira permisos de administración global. Los Superadmins pueden gestionar partidos, ingresar marcadores y administrar competencias de manera global.
        </p>

        <UsersAdminClient users={users} leagues={activeLeagues} currentUserId={user.id} />
      </div>
    </div>
  );
}
