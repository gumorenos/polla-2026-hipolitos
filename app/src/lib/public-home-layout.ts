export const CHAMPION_SURVIVOR_HOME_SECTIONS = [
  { id: 'survival', label: 'Supervivencia' },
  { id: 'matches', label: 'Fixture' },
  { id: 'fifa', label: 'Grupos FIFA' },
] as const;

export const CHAMPION_SURVIVOR_OVERVIEW_BLOCKS = [
  'participant_picks',
  'compact_summary',
  'team_market_analysis',
  'survival_table',
] as const;

export const PUBLIC_FIXTURE_BLOCKS = ['upcoming_matches', 'recent_results'] as const;

export const PUBLIC_CHAMPION_PICK_COLUMNS = ['participant', 'team', 'status'] as const;
