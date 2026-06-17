import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight route guard (Next.js 16 proxy convention).
 *
 * Performs a cookie-existence check ONLY — no internal HTTP fetch, which
 * caused "fetch failed" errors in production when the server tried to call
 * itself.
 *
 * Real session validation (including superadmin checks) is handled server-side
 * inside each protected Server Component via getCurrentSession().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for the Better Auth session cookie
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');

  if (!sessionCookie?.value) {
    // No session cookie at all → redirect to login, preserving the intended URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — allow through. The Server Component will call
  // getCurrentSession() to verify the session is real and not expired.
  return NextResponse.next();
}

// Match all protected routes
export const config = {
  matcher: [
    '/liga/:path*',
    '/competencia/:path*',
    '/pronosticos/:path*',
    '/ranking/:path*',
    '/perfil/:path*',
    '/admin/:path*',
  ],
};
