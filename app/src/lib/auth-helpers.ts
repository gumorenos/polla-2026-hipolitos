import { auth } from './auth';
import { headers } from 'next/headers';

/**
 * Retrieves the current session and user details on the server.
 * Compatible with Next.js Server Components, Route Handlers, and Server Actions.
 */
export async function getCurrentSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    console.error('Error fetching server session:', error);
    return null;
  }
}
