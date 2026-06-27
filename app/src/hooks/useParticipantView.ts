'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Returns true when the superadmin has activated participant-view mode
 * by navigating to any page with ?view=participant in the URL.
 *
 * This is a UI-only mode. The authenticated user and their server-side
 * permissions remain completely unchanged.
 */
export function useParticipantView(): boolean {
  const searchParams = useSearchParams();
  return searchParams.get('view') === 'participant';
}
