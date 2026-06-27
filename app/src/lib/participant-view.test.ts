import { describe, expect, it } from 'vitest';
import {
  getEffectiveViewMode,
  isParticipantPreview,
  parseViewMode,
  shouldShowAdminUi,
} from './view-mode';

describe('participant view mode', () => {
  it('accepts only supported persisted values', () => {
    expect(parseViewMode('admin')).toBe('admin');
    expect(parseViewMode('participant')).toBe('participant');
    expect(parseViewMode('invalid')).toBeNull();
    expect(parseViewMode(null)).toBeNull();
  });

  it('defaults superadmins to admin mode', () => {
    expect(getEffectiveViewMode(true, null)).toBe('admin');
    expect(getEffectiveViewMode(true, 'invalid')).toBe('admin');
  });

  it('restores a superadmin participant preference', () => {
    expect(getEffectiveViewMode(true, 'participant')).toBe('participant');
  });

  it('never turns a normal user into an admin through the cookie', () => {
    expect(getEffectiveViewMode(false, 'admin')).toBe('participant');
    expect(shouldShowAdminUi(false, 'admin')).toBe(false);
  });

  it('shows participant preview indicators only to superadmins', () => {
    expect(isParticipantPreview(true, 'participant')).toBe(true);
    expect(isParticipantPreview(true, 'admin')).toBe(false);
    expect(isParticipantPreview(false, 'participant')).toBe(false);
  });

  it('shows admin UI only to a superadmin in admin mode', () => {
    expect(shouldShowAdminUi(true, 'admin')).toBe(true);
    expect(shouldShowAdminUi(true, 'participant')).toBe(false);
  });
});
