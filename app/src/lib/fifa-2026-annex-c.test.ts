import { describe, expect, it } from 'vitest';
import {
  ANNEX_C_SLOTS,
  ANNEX_C_THIRD_PLACE_ALLOCATIONS,
  canonicalThirdPlaceGroups,
  getAnnexCAllocationForGroups,
  resolveThirdPlacePlaceholder,
  validateAnnexCTable,
} from './fifa-2026-annex-c';

describe('FIFA World Cup 2026 Annex C', () => {
  it('contains every valid 12-choose-8 combination with valid assignments', () => {
    const keys = Object.keys(ANNEX_C_THIRD_PLACE_ALLOCATIONS);

    expect(keys).toHaveLength(495);
    expect(validateAnnexCTable(ANNEX_C_THIRD_PLACE_ALLOCATIONS)).toEqual([]);
    for (const key of keys) {
      expect(key).toMatch(/^[A-L]{8}$/);
      expect(key).toBe([...key].sort().join(''));
      expect(new Set(key).size).toBe(8);

      const allocation = ANNEX_C_THIRD_PLACE_ALLOCATIONS[key];
      expect(Object.keys(allocation).sort()).toEqual([...ANNEX_C_SLOTS].sort());
      const assignedGroups = ANNEX_C_SLOTS.map((slot) => allocation[slot].slice(1));
      expect(new Set(assignedGroups).size).toBe(8);
      expect(assignedGroups.sort().join('')).toBe(key);
    }
  });

  it('canonicalizes eight qualified third-place groups', () => {
    expect(canonicalThirdPlaceGroups(['K', 'B', 'D', 'L', 'F', 'E', 'I', 'J']))
      .toBe('BDEFIJKL');
  });

  it('rejects invalid combinations and reports a missing valid key safely', () => {
    expect(() => canonicalThirdPlaceGroups(['A', 'B', 'C'])).toThrow(
      'Annex C requiere exactamente ocho grupos únicos entre A y L.',
    );
    expect(() => canonicalThirdPlaceGroups(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'G']))
      .toThrow('Annex C requiere exactamente ocho grupos únicos entre A y L.');
    expect(getAnnexCAllocationForGroups(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      {},
    )).toBeNull();
  });

  it('matches the completed production group combination and resolves by slot', () => {
    const allocation = getAnnexCAllocationForGroups(['B', 'D', 'E', 'F', 'I', 'J', 'K', 'L']);

    expect(allocation).toEqual({
      vs1A: '3E',
      vs1B: '3J',
      vs1D: '3B',
      vs1E: '3D',
      vs1G: '3I',
      vs1I: '3F',
      vs1K: '3L',
      vs1L: '3K',
    });
    expect(allocation && resolveThirdPlacePlaceholder('3CEFHI', 'vs1A', allocation)).toBe('3E');
    expect(allocation && resolveThirdPlacePlaceholder('3ABCDF', 'vs1E', allocation)).toBe('3D');
    expect(allocation && resolveThirdPlacePlaceholder('3ABCDF', 'vs1A', allocation)).toBeNull();
  });
});
