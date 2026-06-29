import { describe, expect, it } from 'vitest';
import {
  getCompetitionParticipationUpdate,
  isCompetitionParticipant,
  summarizeCompetitionMembers,
  wouldRemoveLastCompetitionAdministrator,
} from './competition-members';
import { calculatePrizePool } from './champion-survivor';

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

  it('allows an owner to become a participant without changing the owner role', () => {
    const owner = {
      userId: 'owner-1',
      role: 'owner',
      isParticipant: false,
      userStatus: 'approved',
    };
    const updatedOwner = { ...owner, ...getCompetitionParticipationUpdate(true) };

    expect(isCompetitionParticipant(owner)).toBe(false);
    expect(isCompetitionParticipant(updatedOwner)).toBe(true);
    expect(updatedOwner.role).toBe('owner');

    const existingAdmin = {
      userId: 'admin-1',
      role: 'admin',
      isParticipant: false,
    };
    const updatedAdmin = {
      ...existingAdmin,
      ...getCompetitionParticipationUpdate(true),
    };
    expect(isCompetitionParticipant(existingAdmin)).toBe(false);
    expect(isCompetitionParticipant(updatedAdmin)).toBe(true);
    expect(updatedAdmin.role).toBe('admin');
  });

  it('updates participant count and estimated prize pool when the owner starts competing', () => {
    const owner = { role: 'owner', isParticipant: false, userStatus: 'approved' };
    const participant = { role: 'member', isParticipant: true, userStatus: 'approved' };
    const before = summarizeCompetitionMembers([owner, participant]);
    const after = summarizeCompetitionMembers([
      { ...owner, ...getCompetitionParticipationUpdate(true) },
      participant,
    ]);

    expect(before.participants).toBe(1);
    expect(after.participants).toBe(2);
    expect(calculatePrizePool({ currency: 'PEN', entryFee: 20 }, after.participants).amount).toBe(40);
    expect(calculatePrizePool({ currency: 'PEN', entryFee: 20, prizePoolOverride: 100 }, after.participants).amount).toBe(100);
  });

  it('prevents removing or demoting the last competition administrator', () => {
    const ownerOnly = [
      { userId: 'owner-1', role: 'owner' },
      { userId: 'member-1', role: 'member' },
    ];
    expect(wouldRemoveLastCompetitionAdministrator(ownerOnly, 'owner-1', 'remove')).toBe(true);

    const adminOnly = [{ userId: 'admin-1', role: 'admin' }];
    expect(wouldRemoveLastCompetitionAdministrator(adminOnly, 'admin-1', 'demote')).toBe(true);

    const ownerAndAdmin = [
      { userId: 'owner-1', role: 'owner' },
      { userId: 'admin-1', role: 'admin' },
    ];
    expect(wouldRemoveLastCompetitionAdministrator(ownerAndAdmin, 'admin-1', 'demote')).toBe(false);
  });
});
