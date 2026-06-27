export function determineLoginRedirect(
  nextUrl: string | null,
  isSuperadmin: boolean,
  status: string | undefined
): string {
  // If there's a valid internal 'next' URL, use it
  if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//')) {
    return nextUrl;
  }
  
  // Superadmins fallback to admin panel
  if (isSuperadmin) {
    return '/admin';
  }
  
  // Approved regular users fallback to their private dashboard
  if (status === 'approved') {
    return '/pronosticos';
  }
  
  // Everyone else (pending, etc) goes to home
  return '/';
}
