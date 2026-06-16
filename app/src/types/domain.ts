export type ScoreType = 'exact' | 'tendency' | 'consolation' | 'miss';
export type MatchStatus = 'open' | 'soon' | 'live' | 'result';
export type PhaseId = 'groups' | 'r32' | 'r16' | 'quarters' | 'semis' | 'final';

export interface UserProfile {
  id: string;
  name: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  whatsapp?: string;
  isSuperadmin: boolean;
  createdAt: string;
}

export interface League {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  pot: number;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface LeagueMember {
  id: string;
  userId: string;
  leagueId: string;
  role: 'admin' | 'member';
  points: number;
  exacts: number;
  tendencies: number;
  consolations: number;
  misses: number;
  joinedAt: string;
}

export interface Team {
  code: string;
  name: string;
  hue: number;
}

export interface Match {
  id: string;
  phase: PhaseId;
  group?: string;
  jornada: string;
  homeTeamCode: string; // references Team.code
  awayTeamCode: string; // references Team.code
  homeScore?: number | null;
  awayScore?: number | null;
  kickoffUtc: Date | string | number;
  status: MatchStatus;
  venue: string;
  city: string;
  resultStatus?: string | null;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  homePrediction: number;
  awayPrediction: number;
  pointsEarned?: number | null;
  scoreType?: ScoreType | null;
  updatedAt: string;
}

export interface Standing {
  leagueId?: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  points: number;
  exacts: number;
  tendencies: number;
  consolations: number;
  misses: number;
  rank: number;
  previousRank: number;
  predictionsSubmitted?: number;
  lastUpdated?: string;
}
