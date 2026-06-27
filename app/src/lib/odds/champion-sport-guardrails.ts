export const THE_ODDS_API_PROVIDER = 'the-odds-api';
export const INVALID_CHAMPION_SPORT_MESSAGE =
  'El sport key seleccionado no parece corresponder al Mundial/FIFA de fútbol. No se importaron cuotas.';

export type ChampionSportDescriptor = {
  key: string;
  group?: string | null;
  title?: string | null;
  description?: string | null;
  has_outrights?: boolean;
};

export type ChampionSportClassification = {
  recommended: boolean;
  reason: string;
};

const EXCLUDED_SPORT_SIGNALS = [
  'americanfootball',
  'american football',
  'nfl',
  'ncaaf',
  'basketball',
  'nba',
  'ncaab',
  'baseball',
  'mlb',
  'icehockey',
  'nhl',
  'mma',
  'boxing',
  'golf',
  'tennis',
  'cricket',
  'rugby',
  'aussierules',
  'lacrosse',
  'college',
];

const EXCLUDED_TOURNAMENT_SIGNALS = [
  'club world cup',
  'club_world_cup',
  'women',
  'womens',
  'u17',
  'u20',
  'youth',
  'qualifier',
  'qualifying',
  'qualification',
];

function searchableSportText(sport: ChampionSportDescriptor): string {
  return [sport.key, sport.group, sport.title, sport.description]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function includesSignal(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

export function classifyChampionSport(
  sport: ChampionSportDescriptor,
): ChampionSportClassification {
  const key = sport.key.trim().toLowerCase();
  const text = searchableSportText(sport);

  if (sport.has_outrights !== true) {
    return { recommended: false, reason: 'El mercado no declara cuotas outright.' };
  }

  if (includesSignal(text, EXCLUDED_SPORT_SIGNALS)) {
    return { recommended: false, reason: 'Pertenece a un deporte distinto del fútbol asociación.' };
  }

  const isAssociationFootball = key.startsWith('soccer_') || text.includes('soccer');
  if (!isAssociationFootball) {
    return { recommended: false, reason: 'No está identificado como mercado de Soccer.' };
  }

  if (includesSignal(text, EXCLUDED_TOURNAMENT_SIGNALS)) {
    return { recommended: false, reason: 'No corresponde al Mundial absoluto objetivo.' };
  }

  const isFifaWorldCup = text.includes('fifa')
    && (text.includes('world cup') || text.includes('world_cup') || text.includes('worldcup'));
  if (!isFifaWorldCup) {
    return { recommended: false, reason: 'No contiene señales suficientes de FIFA World Cup.' };
  }

  return { recommended: true, reason: 'Mercado outright de Soccer para FIFA World Cup.' };
}

export function isRecommendedChampionSport(sport: ChampionSportDescriptor): boolean {
  return classifyChampionSport(sport).recommended;
}

export function isRecommendedChampionSportKey(sportKey: string): boolean {
  return isRecommendedChampionSport({
    key: sportKey,
    has_outrights: true,
  });
}
