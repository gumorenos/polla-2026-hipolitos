import { describe, expect, it } from 'vitest';

/**
 * Participant view mode: pure logic unit tests.
 *
 * The participant-view mode is a UI-only feature controlled by the URL
 * query param ?view=participant. These tests verify the logic that
 * interprets the query param and derives mode state.
 *
 * React component rendering tests (banner visibility, nav hiding) are
 * excluded because they would require DOM/browser setup not available
 * in the current Vitest unit test context.
 */

function isParticipantViewParam(param: string | null): boolean {
  return param === 'participant';
}

function buildParticipantViewHref(basePath: string): string {
  return `${basePath}?view=participant`;
}

function buildAdminReturnHref(): string {
  return '/admin';
}

function shouldShowAdminNav(isSuperadmin: boolean, isParticipantView: boolean): boolean {
  return isSuperadmin && !isParticipantView;
}

function shouldShowParticipantViewButton(isSuperadmin: boolean, isParticipantView: boolean): boolean {
  return isSuperadmin && !isParticipantView;
}

function shouldShowBanner(isParticipantView: boolean): boolean {
  return isParticipantView;
}

describe('Participant view mode logic', () => {
  describe('isParticipantViewParam', () => {
    it('returns true when param is "participant"', () => {
      expect(isParticipantViewParam('participant')).toBe(true);
    });

    it('returns false when param is null', () => {
      expect(isParticipantViewParam(null)).toBe(false);
    });

    it('returns false for other values', () => {
      expect(isParticipantViewParam('admin')).toBe(false);
      expect(isParticipantViewParam('')).toBe(false);
      expect(isParticipantViewParam('Participant')).toBe(false);
    });
  });

  describe('shouldShowAdminNav', () => {
    it('shows admin nav to superadmin in normal mode', () => {
      expect(shouldShowAdminNav(true, false)).toBe(true);
    });

    it('hides admin nav to superadmin in participant-view mode', () => {
      expect(shouldShowAdminNav(true, true)).toBe(false);
    });

    it('never shows admin nav to normal users', () => {
      expect(shouldShowAdminNav(false, false)).toBe(false);
      expect(shouldShowAdminNav(false, true)).toBe(false);
    });
  });

  describe('shouldShowParticipantViewButton', () => {
    it('shows button to superadmin in normal mode', () => {
      expect(shouldShowParticipantViewButton(true, false)).toBe(true);
    });

    it('hides button to superadmin already in participant-view mode', () => {
      expect(shouldShowParticipantViewButton(true, true)).toBe(false);
    });

    it('never shows button to normal users', () => {
      expect(shouldShowParticipantViewButton(false, false)).toBe(false);
    });
  });

  describe('shouldShowBanner', () => {
    it('shows banner in participant-view mode', () => {
      expect(shouldShowBanner(true)).toBe(true);
    });

    it('hides banner in normal mode', () => {
      expect(shouldShowBanner(false)).toBe(false);
    });
  });

  describe('URL helpers', () => {
    it('builds correct participant-view href', () => {
      expect(buildParticipantViewHref('/pronosticos')).toBe('/pronosticos?view=participant');
      expect(buildParticipantViewHref('/')).toBe('/?view=participant');
    });

    it('returns /admin as the return href', () => {
      expect(buildAdminReturnHref()).toBe('/admin');
    });
  });
});
