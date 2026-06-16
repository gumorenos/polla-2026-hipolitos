import { PrismaClient } from '@prisma/client';
import { auth } from '../src/lib/auth';

const prisma = new PrismaClient();

// Venues dictionary
const VENUES = {
  MEX: { venue: 'Estadio Azteca',           city: 'Ciudad de México' },
  GDL: { venue: 'Estadio Akron',            city: 'Guadalajara'      },
  MTY: { venue: 'Estadio BBVA',             city: 'Monterrey'        },
  VAN: { venue: 'BC Place',                city: 'Vancouver'        },
  TOR: { venue: 'BMO Field',               city: 'Toronto'          },
  NYC: { venue: 'MetLife Stadium',          city: 'Nueva York'       },
  BOS: { venue: 'Gillette Stadium',         city: 'Boston'           },
  PHI: { venue: 'Lincoln Financial Field',  city: 'Filadelfia'       },
  MIA: { venue: 'Hard Rock Stadium',        city: 'Miami'            },
  DAL: { venue: 'AT&T Stadium',            city: 'Dallas'           },
  HOU: { venue: 'NRG Stadium',             city: 'Houston'          },
  KCY: { venue: 'Arrowhead Stadium',        city: 'Kansas City'      },
  SFO: { venue: "Levi's Stadium",           city: 'San Francisco'    },
  LAX: { venue: 'SoFi Stadium',            city: 'Los Ángeles'      },
  SEA: { venue: 'Lumen Field',             city: 'Seattle'          },
  ATL: { venue: 'Mercedes-Benz Stadium',    city: 'Atlanta'          },
} as const;

type VK = keyof typeof VENUES;

// Teams to seed
const TEAMS = [
  // CONCACAF
  { code: 'USA', name: 'Estados Unidos',       hue: 222 },
  { code: 'MEX', name: 'México',               hue: 142 },
  { code: 'CAN', name: 'Canadá',               hue: 0   },
  { code: 'PAN', name: 'Panamá',               hue: 350 },
  // CONMEBOL
  { code: 'ARG', name: 'Argentina',            hue: 205 },
  { code: 'BRA', name: 'Brasil',               hue: 52  },
  { code: 'COL', name: 'Colombia',             hue: 48  },
  { code: 'URU', name: 'Uruguay',              hue: 200 },
  { code: 'ECU', name: 'Ecuador',              hue: 45  },
  { code: 'PAR', name: 'Paraguay',             hue: 200 },
  // UEFA
  { code: 'FRA', name: 'Francia',              hue: 230 },
  { code: 'ESP', name: 'España',               hue: 8   },
  { code: 'GER', name: 'Alemania',             hue: 50  },
  { code: 'ENG', name: 'Inglaterra',           hue: 220 },
  { code: 'POR', name: 'Portugal',             hue: 142 },
  { code: 'NED', name: 'Países Bajos',         hue: 30  },
  { code: 'BEL', name: 'Bélgica',             hue: 0   },
  { code: 'CRO', name: 'Croacia',             hue: 350 },
  { code: 'SUI', name: 'Suiza',               hue: 0   },
  { code: 'AUT', name: 'Austria',             hue: 4   },
  { code: 'SCO', name: 'Escocia',             hue: 210 },
  { code: 'TUR', name: 'Türkiye',             hue: 15  },
  { code: 'SWE', name: 'Suecia',              hue: 50  },
  { code: 'NOR', name: 'Noruega',             hue: 5   },
  { code: 'CZE', name: 'Chequia',             hue: 0   },
  { code: 'BIH', name: 'Bosnia y Herzeg.',    hue: 205 },
  // CAF
  { code: 'MAR', name: 'Marruecos',           hue: 350 },
  { code: 'SEN', name: 'Senegal',             hue: 150 },
  { code: 'EGY', name: 'Egipto',             hue: 5   },
  { code: 'CIV', name: 'Costa de Marfil',    hue: 28  },
  { code: 'ALG', name: 'Argelia',            hue: 145 },
  { code: 'TUN', name: 'Túnez',              hue: 10  },
  { code: 'RSA', name: 'Sudáfrica',          hue: 130 },
  { code: 'GHA', name: 'Ghana',              hue: 50  },
  { code: 'COD', name: 'Congo DR',           hue: 210 },
  // AFC
  { code: 'JPN', name: 'Japón',              hue: 0   },
  { code: 'KOR', name: 'Corea del Sur',      hue: 0   },
  { code: 'IRI', name: 'Irán',               hue: 142 },
  { code: 'KSA', name: 'Arabia Saudita',     hue: 135 },
  { code: 'AUS', name: 'Australia',          hue: 50  },
  { code: 'IRQ', name: 'Irak',               hue: 90  },
  { code: 'UZB', name: 'Uzbekistán',         hue: 168 },
  { code: 'QAT', name: 'Qatar',              hue: 320 },
  { code: 'JOR', name: 'Jordania',           hue: 350 },
  // OFC
  { code: 'NZL', name: 'Nueva Zelanda',      hue: 225 },
  // Others
  { code: 'HAI', name: 'Haití',              hue: 210 },
  { code: 'CPV', name: 'Cabo Verde',          hue: 160 },
  { code: 'CUR', name: 'Curazao',            hue: 210 },
  // Placeholder Codes for Knockout pairing slots
  { code: '2A',  name: 'Segundo Grupo A',      hue: 220 },
  { code: '2B',  name: 'Segundo Grupo B',      hue: 220 },
  { code: '1C',  name: 'Ganador Grupo C',      hue: 220 },
  { code: '2F',  name: 'Segundo Grupo F',      hue: 220 },
  { code: '1E',  name: 'Ganador Grupo E',      hue: 220 },
  { code: '3ABCDF', name: 'Tercero A/B/C/D/F', hue: 220 },
  { code: '1F',  name: 'Ganador Grupo F',      hue: 220 },
  { code: '2C',  name: 'Segundo Grupo C',      hue: 220 },
  { code: '2E',  name: 'Segundo Grupo E',      hue: 220 },
  { code: '2I',  name: 'Segundo Grupo I',      hue: 220 },
  { code: '1I',  name: 'Ganador Grupo I',      hue: 220 },
  { code: '3CDFGH', name: 'Tercero C/D/F/G/H', hue: 220 },
  { code: '1A',  name: 'Ganador Grupo A',      hue: 220 },
  { code: '3CEFHI', name: 'Tercero C/E/F/H/I', hue: 220 },
  { code: '1L',  name: 'Ganador Grupo L',      hue: 220 },
  { code: '3EHIJK', name: 'Tercero E/H/I/J/K', hue: 220 },
  { code: '1G',  name: 'Ganador Grupo G',      hue: 220 },
  { code: '3AEHIJ', name: 'Tercero A/E/H/I/J', hue: 220 },
  { code: '1D',  name: 'Ganador Grupo D',      hue: 220 },
  { code: '3BEFIJ', name: 'Tercero B/E/F/I/J', hue: 220 },
  { code: '1H',  name: 'Ganador Grupo H',      hue: 220 },
  { code: '2J',  name: 'Segundo Grupo J',      hue: 220 },
  { code: '2K',  name: 'Segundo Grupo K',      hue: 220 },
  { code: '2L',  name: 'Segundo Grupo L',      hue: 220 },
  { code: '1B',  name: 'Ganador Grupo B',      hue: 220 },
  { code: '3EFGIJ', name: 'Tercero E/F/G/I/J', hue: 220 },
  { code: '2D',  name: 'Segundo Grupo D',      hue: 220 },
  { code: '2G',  name: 'Segundo Grupo G',      hue: 220 },
  { code: '1J',  name: 'Ganador Grupo J',      hue: 220 },
  { code: '2H',  name: 'Segundo Grupo H',      hue: 220 },
  { code: '1K',  name: 'Ganador Grupo K',      hue: 220 },
  { code: '3DEIJL', name: 'Tercero D/E/I/J/L', hue: 220 },
  { code: 'W73', name: 'Ganador Partido 73',   hue: 220 },
  { code: 'W74', name: 'Ganador Partido 74',   hue: 220 },
  { code: 'W75', name: 'Ganador Partido 75',   hue: 220 },
  { code: 'W76', name: 'Ganador Partido 76',   hue: 220 },
  { code: 'W77', name: 'Ganador Partido 77',   hue: 220 },
  { code: 'W78', name: 'Ganador Partido 78',   hue: 220 },
  { code: 'W79', name: 'Ganador Partido 79',   hue: 220 },
  { code: 'W80', name: 'Ganador Partido 80',   hue: 220 },
  { code: 'W81', name: 'Ganador Partido 81',   hue: 220 },
  { code: 'W82', name: 'Ganador Partido 82',   hue: 220 },
  { code: 'W83', name: 'Ganador Partido 83',   hue: 220 },
  { code: 'W84', name: 'Ganador Partido 84',   hue: 220 },
  { code: 'W85', name: 'Ganador Partido 85',   hue: 220 },
  { code: 'W86', name: 'Ganador Partido 86',   hue: 220 },
  { code: 'W87', name: 'Ganador Partido 87',   hue: 220 },
  { code: 'W88', name: 'Ganador Partido 88',   hue: 220 },
  { code: 'W89', name: 'Ganador Partido 89',   hue: 220 },
  { code: 'W90', name: 'Ganador Partido 90',   hue: 220 },
  { code: 'W91', name: 'Ganador Partido 91',   hue: 220 },
  { code: 'W92', name: 'Ganador Partido 92',   hue: 220 },
  { code: 'W93', name: 'Ganador Partido 93',   hue: 220 },
  { code: 'W94', name: 'Ganador Partido 94',   hue: 220 },
  { code: 'W95', name: 'Ganador Partido 95',   hue: 220 },
  { code: 'W96', name: 'Ganador Partido 96',   hue: 220 },
  { code: 'W97', name: 'Ganador Partido 97',   hue: 220 },
  { code: 'W98', name: 'Ganador Partido 98',   hue: 220 },
  { code: 'W99', name: 'Ganador Partido 99',   hue: 220 },
  { code: 'W100', name: 'Ganador Partido 100', hue: 220 },
  { code: 'W101', name: 'Ganador Partido 101', hue: 220 },
  { code: 'W102', name: 'Ganador Partido 102', hue: 220 },
  { code: 'RU101', name: 'Perdedor Partido 101', hue: 220 },
  { code: 'RU102', name: 'Perdedor Partido 102', hue: 220 },
];

// Matches raw data helper
interface RawMatch {
  id: string;
  phase: string;
  group?: string;
  jornada: string;
  home: string;
  away: string;
  vk: VK;
  kickoff: string;
}

const MATCHES: RawMatch[] = [
  // GROUP A
  { id: 'gA1', phase: 'groups', group: 'A', jornada: 'Fecha 1', home: 'MEX', away: 'RSA', vk: 'MEX', kickoff: '2026-06-11T20:00:00Z' },
  { id: 'gA2', phase: 'groups', group: 'A', jornada: 'Fecha 1', home: 'KOR', away: 'CZE', vk: 'GDL', kickoff: '2026-06-12T03:00:00Z' },
  { id: 'gA3', phase: 'groups', group: 'A', jornada: 'Fecha 2', home: 'CZE', away: 'RSA', vk: 'ATL', kickoff: '2026-06-18T15:00:00Z' },
  { id: 'gA4', phase: 'groups', group: 'A', jornada: 'Fecha 2', home: 'MEX', away: 'KOR', vk: 'GDL', kickoff: '2026-06-19T02:00:00Z' },
  { id: 'gA5', phase: 'groups', group: 'A', jornada: 'Fecha 3', home: 'CZE', away: 'MEX', vk: 'MEX', kickoff: '2026-06-25T02:00:00Z' },
  { id: 'gA6', phase: 'groups', group: 'A', jornada: 'Fecha 3', home: 'RSA', away: 'KOR', vk: 'MTY', kickoff: '2026-06-25T02:00:00Z' },

  // GROUP B
  { id: 'gB1', phase: 'groups', group: 'B', jornada: 'Fecha 1', home: 'CAN', away: 'BIH', vk: 'TOR', kickoff: '2026-06-12T18:00:00Z' },
  { id: 'gB2', phase: 'groups', group: 'B', jornada: 'Fecha 1', home: 'QAT', away: 'SUI', vk: 'SFO', kickoff: '2026-06-13T21:00:00Z' },
  { id: 'gB3', phase: 'groups', group: 'B', jornada: 'Fecha 2', home: 'SUI', away: 'BIH', vk: 'LAX', kickoff: '2026-06-18T21:00:00Z' },
  { id: 'gB4', phase: 'groups', group: 'B', jornada: 'Fecha 2', home: 'CAN', away: 'QAT', vk: 'VAN', kickoff: '2026-06-19T00:00:00Z' },
  { id: 'gB5', phase: 'groups', group: 'B', jornada: 'Fecha 3', home: 'SUI', away: 'CAN', vk: 'VAN', kickoff: '2026-06-24T21:00:00Z' },
  { id: 'gB6', phase: 'groups', group: 'B', jornada: 'Fecha 3', home: 'BIH', away: 'QAT', vk: 'SEA', kickoff: '2026-06-24T21:00:00Z' },

  // GROUP C
  { id: 'gC1', phase: 'groups', group: 'C', jornada: 'Fecha 1', home: 'BRA', away: 'MAR', vk: 'NYC', kickoff: '2026-06-13T21:00:00Z' },
  { id: 'gC2', phase: 'groups', group: 'C', jornada: 'Fecha 1', home: 'HAI', away: 'SCO', vk: 'BOS', kickoff: '2026-06-14T00:00:00Z' },
  { id: 'gC3', phase: 'groups', group: 'C', jornada: 'Fecha 2', home: 'SCO', away: 'MAR', vk: 'BOS', kickoff: '2026-06-19T21:00:00Z' },
  { id: 'gC4', phase: 'groups', group: 'C', jornada: 'Fecha 2', home: 'BRA', away: 'HAI', vk: 'PHI', kickoff: '2026-06-19T23:30:00Z' },
  { id: 'gC5', phase: 'groups', group: 'C', jornada: 'Fecha 3', home: 'SCO', away: 'BRA', vk: 'MIA', kickoff: '2026-06-24T21:00:00Z' },
  { id: 'gC6', phase: 'groups', group: 'C', jornada: 'Fecha 3', home: 'MAR', away: 'HAI', vk: 'ATL', kickoff: '2026-06-24T21:00:00Z' },

  // GROUP D
  { id: 'gD1', phase: 'groups', group: 'D', jornada: 'Fecha 1', home: 'USA', away: 'PAR', vk: 'LAX', kickoff: '2026-06-13T03:00:00Z' },
  { id: 'gD2', phase: 'groups', group: 'D', jornada: 'Fecha 1', home: 'AUS', away: 'TUR', vk: 'VAN', kickoff: '2026-06-14T06:00:00Z' },
  { id: 'gD3', phase: 'groups', group: 'D', jornada: 'Fecha 2', home: 'USA', away: 'AUS', vk: 'SEA', kickoff: '2026-06-19T21:00:00Z' },
  { id: 'gD4', phase: 'groups', group: 'D', jornada: 'Fecha 2', home: 'TUR', away: 'PAR', vk: 'SFO', kickoff: '2026-06-20T05:00:00Z' },
  { id: 'gD5', phase: 'groups', group: 'D', jornada: 'Fecha 3', home: 'TUR', away: 'USA', vk: 'LAX', kickoff: '2026-06-26T04:00:00Z' },
  { id: 'gD6', phase: 'groups', group: 'D', jornada: 'Fecha 3', home: 'PAR', away: 'AUS', vk: 'SFO', kickoff: '2026-06-26T04:00:00Z' },

  // GROUP E
  { id: 'gE1', phase: 'groups', group: 'E', jornada: 'Fecha 1', home: 'GER', away: 'CUR', vk: 'HOU', kickoff: '2026-06-14T17:00:00Z' },
  { id: 'gE2', phase: 'groups', group: 'E', jornada: 'Fecha 1', home: 'CIV', away: 'ECU', vk: 'PHI', kickoff: '2026-06-14T22:00:00Z' },
  { id: 'gE3', phase: 'groups', group: 'E', jornada: 'Fecha 2', home: 'GER', away: 'CIV', vk: 'TOR', kickoff: '2026-06-20T19:00:00Z' },
  { id: 'gE4', phase: 'groups', group: 'E', jornada: 'Fecha 2', home: 'ECU', away: 'CUR', vk: 'KCY', kickoff: '2026-06-21T00:00:00Z' },
  { id: 'gE5', phase: 'groups', group: 'E', jornada: 'Fecha 3', home: 'CUR', away: 'CIV', vk: 'PHI', kickoff: '2026-06-25T19:00:00Z' },
  { id: 'gE6', phase: 'groups', group: 'E', jornada: 'Fecha 3', home: 'ECU', away: 'GER', vk: 'NYC', kickoff: '2026-06-25T19:00:00Z' },

  // GROUP F
  { id: 'gF1', phase: 'groups', group: 'F', jornada: 'Fecha 1', home: 'NED', away: 'JPN', vk: 'DAL', kickoff: '2026-06-14T20:00:00Z' },
  { id: 'gF2', phase: 'groups', group: 'F', jornada: 'Fecha 1', home: 'SWE', away: 'TUN', vk: 'MTY', kickoff: '2026-06-15T02:00:00Z' },
  { id: 'gF3', phase: 'groups', group: 'F', jornada: 'Fecha 2', home: 'NED', away: 'SWE', vk: 'HOU', kickoff: '2026-06-20T17:00:00Z' },
  { id: 'gF4', phase: 'groups', group: 'F', jornada: 'Fecha 2', home: 'TUN', away: 'JPN', vk: 'MTY', kickoff: '2026-06-21T05:00:00Z' },
  { id: 'gF5', phase: 'groups', group: 'F', jornada: 'Fecha 3', home: 'JPN', away: 'SWE', vk: 'DAL', kickoff: '2026-06-25T23:00:00Z' },
  { id: 'gF6', phase: 'groups', group: 'F', jornada: 'Fecha 3', home: 'TUN', away: 'NED', vk: 'KCY', kickoff: '2026-06-25T23:00:00Z' },

  // GROUP G
  { id: 'gG1', phase: 'groups', group: 'G', jornada: 'Fecha 1', home: 'BEL', away: 'EGY', vk: 'SEA', kickoff: '2026-06-15T21:00:00Z' },
  { id: 'gG2', phase: 'groups', group: 'G', jornada: 'Fecha 1', home: 'IRI', away: 'NZL', vk: 'LAX', kickoff: '2026-06-16T03:00:00Z' },
  { id: 'gG3', phase: 'groups', group: 'G', jornada: 'Fecha 2', home: 'BEL', away: 'IRI', vk: 'LAX', kickoff: '2026-06-21T21:00:00Z' },
  { id: 'gG4', phase: 'groups', group: 'G', jornada: 'Fecha 2', home: 'NZL', away: 'EGY', vk: 'VAN', kickoff: '2026-06-22T03:00:00Z' },
  { id: 'gG5', phase: 'groups', group: 'G', jornada: 'Fecha 3', home: 'EGY', away: 'IRI', vk: 'SEA', kickoff: '2026-06-27T05:00:00Z' },
  { id: 'gG6', phase: 'groups', group: 'G', jornada: 'Fecha 3', home: 'NZL', away: 'BEL', vk: 'VAN', kickoff: '2026-06-27T05:00:00Z' },

  // GROUP H
  { id: 'gH1', phase: 'groups', group: 'H', jornada: 'Fecha 1', home: 'ESP', away: 'CPV', vk: 'ATL', kickoff: '2026-06-15T15:00:00Z' },
  { id: 'gH2', phase: 'groups', group: 'H', jornada: 'Fecha 1', home: 'KSA', away: 'URU', vk: 'MIA', kickoff: '2026-06-15T21:00:00Z' },
  { id: 'gH3', phase: 'groups', group: 'H', jornada: 'Fecha 2', home: 'ESP', away: 'KSA', vk: 'ATL', kickoff: '2026-06-21T15:00:00Z' },
  { id: 'gH4', phase: 'groups', group: 'H', jornada: 'Fecha 2', home: 'URU', away: 'CPV', vk: 'MIA', kickoff: '2026-06-21T21:00:00Z' },
  { id: 'gH5', phase: 'groups', group: 'H', jornada: 'Fecha 3', home: 'CPV', away: 'KSA', vk: 'HOU', kickoff: '2026-06-27T00:00:00Z' },
  { id: 'gH6', phase: 'groups', group: 'H', jornada: 'Fecha 3', home: 'URU', away: 'ESP', vk: 'GDL', kickoff: '2026-06-27T01:00:00Z' },

  // GROUP I
  { id: 'gI1', phase: 'groups', group: 'I', jornada: 'Fecha 1', home: 'FRA', away: 'SEN', vk: 'NYC', kickoff: '2026-06-16T18:00:00Z' },
  { id: 'gI2', phase: 'groups', group: 'I', jornada: 'Fecha 1', home: 'IRQ', away: 'NOR', vk: 'BOS', kickoff: '2026-06-16T21:00:00Z' },
  { id: 'gI3', phase: 'groups', group: 'I', jornada: 'Fecha 2', home: 'FRA', away: 'IRQ', vk: 'PHI', kickoff: '2026-06-22T20:00:00Z' },
  { id: 'gI4', phase: 'groups', group: 'I', jornada: 'Fecha 2', home: 'NOR', away: 'SEN', vk: 'NYC', kickoff: '2026-06-22T23:00:00Z' },
  { id: 'gI5', phase: 'groups', group: 'I', jornada: 'Fecha 3', home: 'NOR', away: 'FRA', vk: 'BOS', kickoff: '2026-06-26T18:00:00Z' },
  { id: 'gI6', phase: 'groups', group: 'I', jornada: 'Fecha 3', home: 'SEN', away: 'IRQ', vk: 'TOR', kickoff: '2026-06-26T18:00:00Z' },

  // GROUP J
  { id: 'gJ1', phase: 'groups', group: 'J', jornada: 'Fecha 1', home: 'ARG', away: 'ALG', vk: 'KCY', kickoff: '2026-06-17T01:00:00Z' },
  { id: 'gJ2', phase: 'groups', group: 'J', jornada: 'Fecha 1', home: 'AUT', away: 'JOR', vk: 'SFO', kickoff: '2026-06-17T06:00:00Z' },
  { id: 'gJ3', phase: 'groups', group: 'J', jornada: 'Fecha 2', home: 'ARG', away: 'AUT', vk: 'DAL', kickoff: '2026-06-22T17:00:00Z' },
  { id: 'gJ4', phase: 'groups', group: 'J', jornada: 'Fecha 2', home: 'JOR', away: 'ALG', vk: 'SFO', kickoff: '2026-06-23T05:00:00Z' },
  { id: 'gJ5', phase: 'groups', group: 'J', jornada: 'Fecha 3', home: 'ALG', away: 'AUT', vk: 'KCY', kickoff: '2026-06-28T02:00:00Z' },
  { id: 'gJ6', phase: 'groups', group: 'J', jornada: 'Fecha 3', home: 'JOR', away: 'ARG', vk: 'DAL', kickoff: '2026-06-28T02:00:00Z' },

  // GROUP K
  { id: 'gK1', phase: 'groups', group: 'K', jornada: 'Fecha 1', home: 'POR', away: 'COD', vk: 'HOU', kickoff: '2026-06-17T17:00:00Z' },
  { id: 'gK2', phase: 'groups', group: 'K', jornada: 'Fecha 1', home: 'UZB', away: 'COL', vk: 'MEX', kickoff: '2026-06-18T03:00:00Z' },
  { id: 'gK3', phase: 'groups', group: 'K', jornada: 'Fecha 2', home: 'POR', away: 'UZB', vk: 'HOU', kickoff: '2026-06-23T17:00:00Z' },
  { id: 'gK4', phase: 'groups', group: 'K', jornada: 'Fecha 2', home: 'COL', away: 'COD', vk: 'GDL', kickoff: '2026-06-24T03:00:00Z' },
  { id: 'gK5', phase: 'groups', group: 'K', jornada: 'Fecha 3', home: 'COL', away: 'POR', vk: 'MIA', kickoff: '2026-06-27T22:30:00Z' },
  { id: 'gK6', phase: 'groups', group: 'K', jornada: 'Fecha 3', home: 'COD', away: 'UZB', vk: 'ATL', kickoff: '2026-06-27T22:30:00Z' },

  // GROUP L
  { id: 'gL1', phase: 'groups', group: 'L', jornada: 'Fecha 1', home: 'ENG', away: 'CRO', vk: 'DAL', kickoff: '2026-06-17T20:00:00Z' },
  { id: 'gL2', phase: 'groups', group: 'L', jornada: 'Fecha 1', home: 'GHA', away: 'PAN', vk: 'TOR', kickoff: '2026-06-17T22:00:00Z' },
  { id: 'gL3', phase: 'groups', group: 'L', jornada: 'Fecha 2', home: 'ENG', away: 'GHA', vk: 'BOS', kickoff: '2026-06-23T19:00:00Z' },
  { id: 'gL4', phase: 'groups', group: 'L', jornada: 'Fecha 2', home: 'PAN', away: 'CRO', vk: 'TOR', kickoff: '2026-06-23T22:00:00Z' },
  { id: 'gL5', phase: 'groups', group: 'L', jornada: 'Fecha 3', home: 'PAN', away: 'ENG', vk: 'NYC', kickoff: '2026-06-27T20:00:00Z' },
  { id: 'gL6', phase: 'groups', group: 'L', jornada: 'Fecha 3', home: 'CRO', away: 'GHA', vk: 'PHI', kickoff: '2026-06-27T20:00:00Z' },

  // ROUND OF 32
  { id: 'r32_01', phase: 'r32', jornada: 'Dieciseisavos', home: '2A', away: '2B', vk: 'LAX', kickoff: '2026-06-28T21:00:00Z' },
  { id: 'r32_02', phase: 'r32', jornada: 'Dieciseisavos', home: '1C', away: '2F', vk: 'HOU', kickoff: '2026-06-29T17:00:00Z' },
  { id: 'r32_03', phase: 'r32', jornada: 'Dieciseisavos', home: '1E', away: '3ABCDF', vk: 'BOS', kickoff: '2026-06-29T19:30:00Z' },
  { id: 'r32_04', phase: 'r32', jornada: 'Dieciseisavos', home: '1F', away: '2C', vk: 'MTY', kickoff: '2026-06-30T02:00:00Z' },
  { id: 'r32_05', phase: 'r32', jornada: 'Dieciseisavos', home: '2E', away: '2I', vk: 'DAL', kickoff: '2026-06-30T17:00:00Z' },
  { id: 'r32_06', phase: 'r32', jornada: 'Dieciseisavos', home: '1I', away: '3CDFGH', vk: 'NYC', kickoff: '2026-06-30T20:00:00Z' },
  { id: 'r32_07', phase: 'r32', jornada: 'Dieciseisavos', home: '1A', away: '3CEFHI', vk: 'MEX', kickoff: '2026-07-01T02:00:00Z' },
  { id: 'r32_08', phase: 'r32', jornada: 'Dieciseisavos', home: '1L', away: '3EHIJK', vk: 'ATL', kickoff: '2026-07-01T15:00:00Z' },
  { id: 'r32_09', phase: 'r32', jornada: 'Dieciseisavos', home: '1G', away: '3AEHIJ', vk: 'SEA', kickoff: '2026-07-01T22:00:00Z' },
  { id: 'r32_10', phase: 'r32', jornada: 'Dieciseisavos', home: '1D', away: '3BEFIJ', vk: 'SFO', kickoff: '2026-07-02T02:00:00Z' },
  { id: 'r32_11', phase: 'r32', jornada: 'Dieciseisavos', home: '1H', away: '2J', vk: 'LAX', kickoff: '2026-07-02T21:00:00Z' },
  { id: 'r32_12', phase: 'r32', jornada: 'Dieciseisavos', home: '2K', away: '2L', vk: 'TOR', kickoff: '2026-07-02T22:00:00Z' },
  { id: 'r32_13', phase: 'r32', jornada: 'Dieciseisavos', home: '1B', away: '3EFGIJ', vk: 'VAN', kickoff: '2026-07-03T05:00:00Z' },
  { id: 'r32_14', phase: 'r32', jornada: 'Dieciseisavos', home: '2D', away: '2G', vk: 'DAL', kickoff: '2026-07-03T18:00:00Z' },
  { id: 'r32_15', phase: 'r32', jornada: 'Dieciseisavos', home: '1J', away: '2H', vk: 'MIA', kickoff: '2026-07-03T21:00:00Z' },
  { id: 'r32_16', phase: 'r32', jornada: 'Dieciseisavos', home: '1K', away: '3DEIJL', vk: 'KCY', kickoff: '2026-07-04T01:30:00Z' },

  // ROUND OF 16
  { id: 'r16_01', phase: 'r16', jornada: 'Octavos', home: 'W73', away: 'W75', vk: 'HOU', kickoff: '2026-07-04T17:00:00Z' },
  { id: 'r16_02', phase: 'r16', jornada: 'Octavos', home: 'W74', away: 'W77', vk: 'PHI', kickoff: '2026-07-04T20:00:00Z' },
  { id: 'r16_03', phase: 'r16', jornada: 'Octavos', home: 'W76', away: 'W78', vk: 'NYC', kickoff: '2026-07-05T19:00:00Z' },
  { id: 'r16_04', phase: 'r16', jornada: 'Octavos', home: 'W79', away: 'W80', vk: 'MEX', kickoff: '2026-07-06T01:00:00Z' },
  { id: 'r16_05', phase: 'r16', jornada: 'Octavos', home: 'W83', away: 'W84', vk: 'DAL', kickoff: '2026-07-06T19:00:00Z' },
  { id: 'r16_06', phase: 'r16', jornada: 'Octavos', home: 'W81', away: 'W82', vk: 'SEA', kickoff: '2026-07-07T02:00:00Z' },
  { id: 'r16_07', phase: 'r16', jornada: 'Octavos', home: 'W86', away: 'W88', vk: 'ATL', kickoff: '2026-07-07T15:00:00Z' },
  { id: 'r16_08', phase: 'r16', jornada: 'Octavos', home: 'W85', away: 'W87', vk: 'VAN', kickoff: '2026-07-07T22:00:00Z' },

  // QUARTERS
  { id: 'qf_01', phase: 'quarters', jornada: 'Cuartos', home: 'W89', away: 'W90', vk: 'BOS', kickoff: '2026-07-09T19:00:00Z' },
  { id: 'qf_02', phase: 'quarters', jornada: 'Cuartos', home: 'W93', away: 'W94', vk: 'LAX', kickoff: '2026-07-10T21:00:00Z' },
  { id: 'qf_03', phase: 'quarters', jornada: 'Cuartos', home: 'W91', away: 'W92', vk: 'MIA', kickoff: '2026-07-11T20:00:00Z' },
  { id: 'qf_04', phase: 'quarters', jornada: 'Cuartos', home: 'W95', away: 'W96', vk: 'KCY', kickoff: '2026-07-12T01:00:00Z' },

  // SEMIS
  { id: 'sf_01', phase: 'semis', jornada: 'Semis', home: 'W97', away: 'W98', vk: 'DAL', kickoff: '2026-07-14T19:00:00Z' },
  { id: 'sf_02', phase: 'semis', jornada: 'Semis', home: 'W99', away: 'W100', vk: 'ATL', kickoff: '2026-07-15T18:00:00Z' },

  // 3RD PLACE & FINAL
  { id: '3rd',  phase: 'semis', jornada: '3er Puesto', home: 'RU101', away: 'RU102', vk: 'MIA', kickoff: '2026-07-18T20:00:00Z' },
  { id: 'final', phase: 'final', jornada: 'Final', home: 'W101', away: 'W102', vk: 'NYC', kickoff: '2026-07-19T18:00:00Z' },
];

async function main() {
  console.log('Iniciando siembra de base de datos de demostración...');
  console.log('Limpiando datos antiguos...');
  await prisma.leagueMember.deleteMany({});
  await prisma.standing.deleteMany({});
  await prisma.prediction.deleteMany({});
  await prisma.winnerPrediction.deleteMany({});
  await prisma.league.deleteMany({});

  // 1. Seed Teams
  console.log('Sembrando equipos...');
  for (const team of TEAMS) {
    await prisma.team.upsert({
      where: { code: team.code },
      update: { name: team.name, hue: team.hue },
      create: { code: team.code, name: team.name, hue: team.hue },
    });
  }

  // 2. Seed Matches
  console.log('Sembrando partidos...');
  for (const match of MATCHES) {
    const venueInfo = VENUES[match.vk];
    await prisma.match.upsert({
      where: { id: match.id },
      update: {
        phase: match.phase,
        group: match.group || null,
        jornada: match.jornada,
        homeTeamCode: match.home,
        awayTeamCode: match.away,
        kickoffUtc: new Date(match.kickoff),
        status: 'open',
        venue: venueInfo.venue,
        city: venueInfo.city,
      },
      create: {
        id: match.id,
        phase: match.phase,
        group: match.group || null,
        jornada: match.jornada,
        homeTeamCode: match.home,
        awayTeamCode: match.away,
        kickoffUtc: new Date(match.kickoff),
        status: 'open',
        venue: venueInfo.venue,
        city: venueInfo.city,
      },
    });
  }

  // 3. Seed Sample Users
  console.log('Sembrando usuarios de demostración...');
  const ctx = await auth.$context;
  const adminHash = await ctx.password.hash('Admin123!');
  const userHash = await ctx.password.hash('User123!');

  const admin = await prisma.user.upsert({
    where: { email: 'gumorenos@example.com' },
    update: {
      name: 'Gus Moreno',
      username: 'gumorenos',
      displayUsername: 'gumorenos',
      displayName: 'Gus Moreno',
      isSuperadmin: true,
      status: 'approved',
      whatsapp: '+573000000000',
    },
    create: {
      id: 'u-1',
      name: 'Gus Moreno',
      username: 'gumorenos',
      displayUsername: 'gumorenos',
      displayName: 'Gus Moreno',
      email: 'gumorenos@example.com',
      emailVerified: true,
      isSuperadmin: true,
      status: 'approved',
      whatsapp: '+573000000000',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const adminAcc = await prisma.account.findFirst({
    where: { userId: admin.id, providerId: 'email' },
  });
  if (!adminAcc) {
    await prisma.account.create({
      data: {
        id: 'acc-1',
        accountId: 'gumorenos@example.com',
        providerId: 'email',
        userId: admin.id,
        password: adminHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.update({
      where: { id: adminAcc.id },
      data: {
        accountId: 'gumorenos@example.com',
        password: adminHash,
      },
    });
  }

  const carlos = await prisma.user.upsert({
    where: { email: 'carlos@example.com' },
    update: {
      name: 'Carlos Ruiz',
      username: 'carlos',
      displayUsername: 'carlos',
      displayName: 'Carlos_CR7',
      status: 'approved',
      whatsapp: '+573000000001',
    },
    create: {
      id: 'u-2',
      name: 'Carlos Ruiz',
      username: 'carlos',
      displayUsername: 'carlos',
      displayName: 'Carlos_CR7',
      email: 'carlos@example.com',
      emailVerified: true,
      isSuperadmin: false,
      status: 'approved',
      whatsapp: '+573000000001',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const carlosAcc = await prisma.account.findFirst({
    where: { userId: carlos.id, providerId: 'email' },
  });
  if (!carlosAcc) {
    await prisma.account.create({
      data: {
        id: 'acc-2',
        accountId: 'carlos@example.com',
        providerId: 'email',
        userId: carlos.id,
        password: userHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.update({
      where: { id: carlosAcc.id },
      data: { password: userHash },
    });
  }

  const mariana = await prisma.user.upsert({
    where: { email: 'mariana@example.com' },
    update: {
      name: 'Mariana Gomez',
      username: 'mariana',
      displayUsername: 'mariana',
      displayName: 'Mariana_10',
      status: 'approved',
      whatsapp: '+573000000002',
    },
    create: {
      id: 'u-3',
      name: 'Mariana Gomez',
      username: 'mariana',
      displayUsername: 'mariana',
      displayName: 'Mariana_10',
      email: 'mariana@example.com',
      emailVerified: true,
      isSuperadmin: false,
      status: 'approved',
      whatsapp: '+573000000002',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const marianaAcc = await prisma.account.findFirst({
    where: { userId: mariana.id, providerId: 'email' },
  });
  if (!marianaAcc) {
    await prisma.account.create({
      data: {
        id: 'acc-3',
        accountId: 'mariana@example.com',
        providerId: 'email',
        userId: mariana.id,
        password: userHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.update({
      where: { id: marianaAcc.id },
      data: { password: userHash },
    });
  }

  // 4. Seed Default/Main Pool
  console.log('Sembrando polla por defecto...');
  const league = await prisma.league.upsert({
    where: { slug: 'hipolitos-2026' },
    update: {
      name: 'La Polla Hipólitos 2026',
      isDefault: true,
      isActive: true,
      entryFee: 50.0,
      currency: 'PEN',
      autoJoin: true,
      inviteEnabled: true,
      championDeadline: new Date('2026-06-28T18:59:00.000Z'),
      championPoints: 10,
    },
    create: {
      id: 'l-1',
      name: 'La Polla Hipólitos 2026',
      slug: 'hipolitos-2026',
      inviteCode: 'HIPO2026',
      createdBy: admin.id,
      status: 'active',
      isDefault: true,
      isActive: true,
      entryFee: 50.0,
      currency: 'PEN',
      autoJoin: true,
      inviteEnabled: true,
      championDeadline: new Date('2026-06-28T18:59:00.000Z'),
      championPoints: 10,
      createdAt: new Date(),
    },
  });

  // 5. Seed League Memberships
  console.log('Asociando miembros a la liga...');
  await prisma.leagueMember.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: admin.id } },
    update: {},
    create: {
      leagueId: league.id,
      userId: admin.id,
      role: 'admin',
    },
  });

  await prisma.leagueMember.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: carlos.id } },
    update: {},
    create: {
      leagueId: league.id,
      userId: carlos.id,
      role: 'member',
    },
  });

  await prisma.leagueMember.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: mariana.id } },
    update: {},
    create: {
      leagueId: league.id,
      userId: mariana.id,
      role: 'member',
    },
  });

  console.log('Base de datos sembrada con éxito.');
}

main()
  .catch((e) => {
    console.error('Error durante la siembra de demostración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
