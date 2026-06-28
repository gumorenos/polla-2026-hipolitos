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

export function summarizeCompetitionMembers(
  members: CompetitionMemberSummaryInput[]
): CompetitionMemberSummary {
  return {
    totalMembers: members.length,
    participants: members.filter(
      (member) => member.isParticipant && member.userStatus === 'approved'
    ).length,
    administrators: members.filter(
      (member) => member.role === 'owner' || member.role === 'admin'
    ).length,
  };
}
