'use client';

import React, { createContext, useContext, useMemo } from 'react';
import {
  getEffectiveViewMode,
  isParticipantPreview,
  shouldShowAdminUi,
  type ViewMode,
} from '../../lib/view-mode';

type ViewModeContextValue = {
  isSuperadmin: boolean;
  viewMode: ViewMode;
  isParticipantPreview: boolean;
  showAdminUi: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue>({
  isSuperadmin: false,
  viewMode: 'participant',
  isParticipantPreview: false,
  showAdminUi: false,
});

type ViewModeProviderProps = {
  children: React.ReactNode;
  isSuperadmin: boolean;
  storedViewMode: ViewMode | null;
};

export function ViewModeProvider({
  children,
  isSuperadmin,
  storedViewMode,
}: ViewModeProviderProps) {
  const value = useMemo(() => {
    const viewMode = getEffectiveViewMode(isSuperadmin, storedViewMode);

    return {
      isSuperadmin,
      viewMode,
      isParticipantPreview: isParticipantPreview(isSuperadmin, viewMode),
      showAdminUi: shouldShowAdminUi(isSuperadmin, viewMode),
    };
  }, [isSuperadmin, storedViewMode]);

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  return useContext(ViewModeContext);
}
