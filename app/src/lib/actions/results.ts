'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { updateMatchResultInternal } from './admin';
import { FIFA_TO_APIFOOTBALL_IDS, lookupTeamId } from '../odds/h2h';
import { getProviderCooldown } from '../odds/providers';

export async function fetchAndSaveMatchResultInternal(
  matchId: string,
  options: { force?: boolean; dryRun?: boolean } = {}
) {
  const { force = false, dryRun = false } = options;

  const match = await prisma.match.findUnique({
    where: { id: matchId }
  });

  if (!match) {
    return { error: 'Partido no encontrado' };
  }

  // If result already final, do not refetch unless forced
  if (match.status === 'result' && !force) {
    return { error: 'El partido ya tiene un resultado final. Usa force para re-consultar.' };
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  const isEnabled = process.env.API_FOOTBALL_ENABLED === 'true';

  if (!isEnabled || !apiKey) {
    return { error: 'API-Football no está habilitado o no está configurado.' };
  }

  const cooldown = force ? null : await getProviderCooldown('api-football');
  if (cooldown) {
    return { error: `API-Football está en cooldown hasta ${cooldown.toISOString()}` };
  }

  // Resolve IDs
  let homeId = FIFA_TO_APIFOOTBALL_IDS[match.homeTeamCode];
  if (!homeId) {
    homeId = (await lookupTeamId(match.homeTeamCode, apiKey)) || 0;
  }
  let awayId = FIFA_TO_APIFOOTBALL_IDS[match.awayTeamCode];
  if (!awayId) {
    awayId = (await lookupTeamId(match.awayTeamCode, apiKey)) || 0;
  }

  if (!homeId || !awayId) {
    return { error: 'No se pudieron resolver los IDs de los equipos en API-Football' };
  }

  // Fetch head-to-head fixtures
  const url = `https://v3.football.api-sports.io/fixtures?h2h=${homeId}-${awayId}`;
  const res = await fetch(url, {
    headers: {
      'x-apisports-key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (res.status === 429) {
    return { error: 'Límite de peticiones de API-Football alcanzado (429)' };
  }

  if (!res.ok) {
    return { error: `La petición a API-Football falló con estado ${res.status}` };
  }

  const data = await res.json();
  if (!data || !data.response || !Array.isArray(data.response)) {
    return { error: 'Respuesta inválida de API-Football' };
  }

  interface ApiFootballFixture {
    fixture: {
      id: number;
      date: string;
      status: {
        short: string;
      };
    };
    goals: {
      home: number | null;
      away: number | null;
    };
    score: {
      penalty: {
        home: number | null;
        away: number | null;
      };
    };
  }

  const fixtures = data.response as ApiFootballFixture[];
  
  // Find the fixture matching our kickoff date
  const matchKickoffDate = new Date(match.kickoffUtc);
  
  const targetFixture = fixtures.find((f) => {
    const fDate = new Date(f.fixture.date);
    const diffMs = Math.abs(fDate.getTime() - matchKickoffDate.getTime());
    return diffMs < 24 * 60 * 60 * 1000;
  });

  if (!targetFixture) {
    return { error: 'No se encontró ningún partido correspondiente en API-Football' };
  }

  const statusShort = targetFixture.fixture.status.short;
  const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

  if (!isFinished) {
    return { error: `El partido no ha finalizado en API-Football. Estado actual: ${statusShort}` };
  }

  const homeScore = targetFixture.goals.home;
  const awayScore = targetFixture.goals.away;

  if (homeScore === null || awayScore === null) {
    return { error: 'El partido no tiene marcadores registrados en la API aún.' };
  }

  const wentToExtraTime = statusShort === 'AET' || statusShort === 'PEN';
  const wentToPenalties = statusShort === 'PEN';
  
  let homePenaltyScore: number | null = null;
  let awayPenaltyScore: number | null = null;
  let winnerTeamCode: string | null = null;

  if (wentToPenalties) {
    homePenaltyScore = targetFixture.score.penalty.home;
    awayPenaltyScore = targetFixture.score.penalty.away;
    if (homePenaltyScore !== null && awayPenaltyScore !== null) {
      winnerTeamCode = homePenaltyScore > awayPenaltyScore ? match.homeTeamCode : match.awayTeamCode;
    }
  } else {
    if (homeScore > awayScore) {
      winnerTeamCode = match.homeTeamCode;
    } else if (awayScore > homeScore) {
      winnerTeamCode = match.awayTeamCode;
    } else {
      winnerTeamCode = null; // Draw
    }
  }

  const resultDetails = {
    homeScore,
    awayScore,
    wentToExtraTime,
    wentToPenalties,
    homePenaltyScore,
    awayPenaltyScore,
    winnerTeamCode
  };

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      result: resultDetails
    };
  }

  const updateRes = await updateMatchResultInternal(matchId, homeScore, awayScore, {
    wentToExtraTime,
    wentToPenalties,
    homePenaltyScore,
    awayPenaltyScore,
    winnerTeamCode,
    resultStatus: 'final',
    resultNotes: `Fetched automatically from API-Football. Fixture ID: ${targetFixture.fixture.id}`,
  });

  if (updateRes.error) {
    return { error: `Error al aplicar resultado: ${updateRes.error}` };
  }

  return { 
    success: true, 
    result: resultDetails
  };
}

export async function fetchAndSaveMatchResultAction(matchId: string, force = false) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    return await fetchAndSaveMatchResultInternal(matchId, { force });
  } catch (error) {
    console.error('Error fetching result from API-Football action:', error);
    return { error: 'Ocurrió un error al consultar el resultado' };
  }
}
