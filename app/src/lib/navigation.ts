export type NavigationVisibility = {
  authenticatedOnly?: boolean;
  adminOnly?: boolean;
};

export function filterVisibleNavigationItems<T extends NavigationVisibility>(
  items: T[],
  options: { isAuthenticated: boolean; showAdminUi: boolean }
): T[] {
  return items.filter((item) => {
    if (item.authenticatedOnly && !options.isAuthenticated) {
      return false;
    }

    if (item.adminOnly) {
      return options.isAuthenticated && options.showAdminUi;
    }

    return true;
  });
}
