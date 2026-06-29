export type CompetitionMemberSummaryInput = {
  role: string;
  isParticipant: boolean;
  userStatus: string | null;
};

export type CompetitionMemberSummary = {
  totalMembers: number;
  participants: number;
  administrators: number;
};

export type CompetitionAdministratorChange = 'remove' | 'demote';

export function isCompetitionAdministratorRole(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export function getCompetitionParticipationUpdate(isParticipant: boolean): { isParticipant: boolean } {
  return { isParticipant };
}

export function isCompetitionParticipant(
  membership: { isParticipant: boolean } | null | undefined,
): boolean {
  return membership?.isParticipant === true;
}

export function wouldRemoveLastCompetitionAdministrator(
  members: Array<{ userId: string; role: string }>,
  targetUserId: string,
  action: CompetitionAdministratorChange,
): boolean {
  const target = members.find((member) => member.userId === targetUserId);
  if (!target || !isCompetitionAdministratorRole(target.role)) return false;
  if (action === 'demote' && target.role !== 'admin') return false;

  return members.filter((member) => (
    member.userId !== targetUserId && isCompetitionAdministratorRole(member.role)
  )).length === 0;
}

export function summarizeCompetitionMembers(
  members: CompetitionMemberSummaryInput[]
): CompetitionMemberSummary {
  return {
    totalMembers: members.length,
    participants: members.filter(
      (member) => member.isParticipant && member.userStatus === 'approved'
    ).length,
    administrators: members.filter(
      (member) => isCompetitionAdministratorRole(member.role)
    ).length,
  };
}
