import { describe, expect, it } from 'vitest';
import { determineLoginRedirect } from './auth-redirect';

describe('Auth Redirect Logic', () => {
  it('preserves valid safe next param for any user', () => {
    // Superadmin with safe next
    expect(determineLoginRedirect('/admin/partidos', true, 'approved')).toBe('/admin/partidos');
    
    // Normal user with safe next
    expect(determineLoginRedirect('/pronosticos?view=participant', false, 'approved')).toBe('/pronosticos?view=participant');
  });

  it('rejects external next URLs', () => {
    // Should fallback to default role behavior
    expect(determineLoginRedirect('https://malicious.com', false, 'approved')).toBe('/pronosticos');
    expect(determineLoginRedirect('//malicious.com', true, 'approved')).toBe('/admin');
  });

  it('redirects superadmins to /admin when no next is provided', () => {
    expect(determineLoginRedirect(null, true, 'approved')).toBe('/admin');
    expect(determineLoginRedirect('', true, 'approved')).toBe('/admin');
  });

  it('redirects approved normal users to /pronosticos when no next is provided', () => {
    expect(determineLoginRedirect(null, false, 'approved')).toBe('/pronosticos');
    expect(determineLoginRedirect('', false, 'approved')).toBe('/pronosticos');
  });

  it('redirects pending or rejected users to / when no next is provided', () => {
    expect(determineLoginRedirect(null, false, 'pending')).toBe('/');
    expect(determineLoginRedirect(null, false, 'rejected')).toBe('/');
  });

  it('handles undefined or null status gracefully', () => {
    // If status is undefined, they go to the fallback /
    expect(determineLoginRedirect(null, false, undefined)).toBe('/');
  });
});
