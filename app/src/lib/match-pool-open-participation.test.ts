import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');

function readSource(relativePath: string): string {
  return readFileSync(resolve(sourceRoot, relativePath), 'utf8');
}

describe('Match Pool open participation architecture', () => {
  it('does not require LeagueMember participation in Match Pool actions', () => {
    const source = readSource('lib/actions/match-pools.ts');
    expect(source).not.toContain('resolveLeagueMembership');
    expect(source).not.toContain('membership?.isParticipant');
    expect(source).toContain("user?.status === 'approved'");
    expect(source).toContain("pool.league.competitionType !== 'match_pool'");
  });

  it('keeps the internal owner non-participant and skips standings on creation', () => {
    const source = readSource('lib/actions/leagues.ts');
    expect(source).toContain('isParticipant: isMatchPool ? false');
    expect(source).toContain('if (!isMatchPool && payload.joinAsParticipant === true)');
    expect(source).toContain('const showOdds = isMatchPool ? false');
  });

  it('renders a dedicated detail instead of the traditional league client', () => {
    const page = readSource('app/liga/[slug]/page.tsx');
    const branchIndex = page.indexOf("if (league.competitionType === 'match_pool')");
    const traditionalIndex = page.indexOf('<LigaDetalleClient');
    expect(branchIndex).toBeGreaterThan(-1);
    expect(page).toContain('<MatchPoolLeagueClient');
    expect(branchIndex).toBeLessThan(traditionalIndex);
  });

  it('keeps champion, standings and fixed-member UI out of the Match Pool detail', () => {
    const source = readSource('components/match-pool/MatchPoolLeagueClient.tsx');
    expect(source).not.toContain('Campeón:');
    expect(source).not.toContain('Posiciones');
    expect(source).not.toContain('Miembros de la competencia');
    expect(source).toContain('No hay miembros fijos');
  });
});
