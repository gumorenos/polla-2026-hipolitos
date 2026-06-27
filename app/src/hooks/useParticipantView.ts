'use client';

import { useViewMode } from '../components/layout/ViewModeProvider';

/**
 * Returns true when the authenticated superadmin has activated the persistent
 * participant preview.
 *
 * This is a UI-only mode. The authenticated user and their server-side
 * permissions remain completely unchanged.
 */
export function useParticipantView(): boolean {
  return useViewMode().isParticipantPreview;
}
