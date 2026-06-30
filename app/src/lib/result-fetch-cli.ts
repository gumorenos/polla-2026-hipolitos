export function parseResultFetchMatchId(args: string[]): string | null {
  const namedArgument = args.find((argument) => argument.startsWith('--matchId='));
  const namedMatchId = namedArgument?.slice('--matchId='.length).trim();
  if (namedMatchId) return namedMatchId;

  const positionalMatchId = args.find((argument) => !argument.startsWith('-'))?.trim();
  return positionalMatchId || null;
}
