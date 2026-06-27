'use client';

import { Eye, Shield } from 'lucide-react';
import {
  VIEW_MODE_COOKIE_MAX_AGE_SECONDS,
  VIEW_MODE_COOKIE_NAME,
  type ViewMode,
} from '../../lib/view-mode';
import { useViewMode } from './ViewModeProvider';

type ViewModeSwitchButtonProps = {
  targetMode: ViewMode;
  redirectTo: string;
  className: string;
};

export function ViewModeSwitchButton({
  targetMode,
  redirectTo,
  className,
}: ViewModeSwitchButtonProps) {
  const { isSuperadmin, viewMode } = useViewMode();

  if (!isSuperadmin || viewMode === targetMode) {
    return null;
  }

  const Icon = targetMode === 'participant' ? Eye : Shield;
  const label = targetMode === 'participant' ? 'Ver como participante' : 'Volver a vista admin';

  const handleSwitch = () => {
    document.cookie = `${VIEW_MODE_COOKIE_NAME}=${targetMode}; Path=/; Max-Age=${VIEW_MODE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    window.location.assign(redirectTo);
  };

  return (
    <button type="button" onClick={handleSwitch} className={className}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
}
