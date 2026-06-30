export type CompetitionTypeValue = 'full_prediction' | 'champion_survivor' | 'match_pool';

const COMPETITION_TYPE_CONTENT: Record<CompetitionTypeValue, { label: string; subtitle: string }> = {
  full_prediction: {
    label: 'Polla completa',
    subtitle: 'Pronósticos de marcadores, campeón y ranking',
  },
  champion_survivor: {
    label: 'Champion Survivor',
    subtitle: 'Elige campeón y sobrevive hasta el final',
  },
  match_pool: {
    label: 'Retos por Partido',
    subtitle: 'Bolsa entre amigos por cada partido',
  },
};

export function isCompetitionType(value: string | null | undefined): value is CompetitionTypeValue {
  return value === 'full_prediction' || value === 'champion_survivor' || value === 'match_pool';
}

export function getCompetitionTypeLabel(value: string | null | undefined): string {
  return isCompetitionType(value) ? COMPETITION_TYPE_CONTENT[value].label : 'Tipo no reconocido';
}

export function getCompetitionTypeSubtitle(value: string | null | undefined): string {
  return isCompetitionType(value) ? COMPETITION_TYPE_CONTENT[value].subtitle : 'Configuración de competencia no reconocida';
}

export function getDefaultCompetitionShowOdds(value: CompetitionTypeValue): boolean {
  return value !== 'match_pool';
}
