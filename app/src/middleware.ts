import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get('cookie') || '';

  try {
    // Request current session details from Better Auth route
    const sessionResponse = await fetch(`${request.nextUrl.origin}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
      },
      next: { revalidate: 0 }, // Disable caching for session validation
    });

    if (!sessionResponse.ok) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const sessionData = await sessionResponse.json();

    // If no active session, redirect to login
    if (!sessionData || !sessionData.session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Server-side Superadmin check for admin routes
    if (pathname.startsWith('/admin')) {
      const isSuperadmin = sessionData.user?.isSuperadmin === true;
      if (!isSuperadmin) {
        // Redirect unauthorized users to root/dashboard page
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Session middleware validation failed:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Define the matching routes for this middleware
export const config = {
  matcher: [
    '/liga/:path*',
    '/pronosticos/:path*',
    '/ranking/:path*',
    '/perfil/:path*',
    '/admin/:path*',
  ],
};
