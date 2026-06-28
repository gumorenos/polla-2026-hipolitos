import { describe, expect, it } from 'vitest';
import { summarizeCompetitionMembers } from './competition-members';

describe('competition membership counts', () => {
  it('separates participants from total members and administrators', () => {
    const members = [
      {
        role: 'owner',
        isParticipant: false,
        userStatus: 'approved',
      },
      ...Array.from({ length: 7 }, () => ({
        role: 'member',
        isParticipant: true,
        userStatus: 'approved',
      })),
    ];

    expect(summarizeCompetitionMembers(members)).toEqual({
      totalMembers: 8,
      participants: 7,
      administrators: 1,
    });
  });

  it('does not count blocked or pending users as active participants', () => {
    expect(summarizeCompetitionMembers([
      { role: 'member', isParticipant: true, userStatus: 'approved' },
      { role: 'member', isParticipant: true, userStatus: 'pending' },
      { role: 'admin', isParticipant: true, userStatus: 'disabled' },
    ])).toEqual({
      totalMembers: 3,
      participants: 1,
      administrators: 1,
    });
  });
});
