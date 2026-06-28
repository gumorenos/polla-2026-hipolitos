import { describe, expect, it } from 'vitest';
import { filterVisibleNavigationItems } from './navigation';

const items = [
  { label: 'Inicio' },
  { label: 'Competencias', authenticatedOnly: true },
  { label: 'Predicciones', authenticatedOnly: true },
  { label: 'Ranking', authenticatedOnly: true },
  { label: 'Perfil', authenticatedOnly: true },
  { label: 'Admin', authenticatedOnly: true, adminOnly: true },
];

describe('navigation visibility', () => {
  it('shows guests only public navigation', () => {
    expect(filterVisibleNavigationItems(items, {
      isAuthenticated: false,
      showAdminUi: false,
    }).map((item) => item.label)).toEqual(['Inicio']);
  });

  it('shows participant navigation to authenticated users', () => {
    expect(filterVisibleNavigationItems(items, {
      isAuthenticated: true,
      showAdminUi: false,
    }).map((item) => item.label)).toEqual([
      'Inicio',
      'Competencias',
      'Predicciones',
      'Ranking',
      'Perfil',
    ]);
  });

  it('shows admin navigation only in authenticated admin view', () => {
    expect(filterVisibleNavigationItems(items, {
      isAuthenticated: true,
      showAdminUi: true,
    }).map((item) => item.label)).toContain('Admin');
  });
});
