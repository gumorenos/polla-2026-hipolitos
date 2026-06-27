export const VIEW_MODE_COOKIE_NAME = 'viewMode';
export const VIEW_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type ViewMode = 'admin' | 'participant';

export function parseViewMode(value: string | null | undefined): ViewMode | null {
  return value === 'admin' || value === 'participant' ? value : null;
}

export function getEffectiveViewMode(
  isSuperadmin: boolean,
  storedMode: string | null | undefined,
): ViewMode {
  if (!isSuperadmin) {
    return 'participant';
  }

  return parseViewMode(storedMode) ?? 'admin';
}

export function isParticipantPreview(isSuperadmin: boolean, viewMode: ViewMode): boolean {
  return isSuperadmin && viewMode === 'participant';
}

export function shouldShowAdminUi(isSuperadmin: boolean, viewMode: ViewMode): boolean {
  return isSuperadmin && viewMode === 'admin';
}
