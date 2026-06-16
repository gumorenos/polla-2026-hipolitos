'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function updateProfileSettingsAction(data: {
  name: string;
  username: string;
  email?: string;
  whatsapp?: string;
}) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const userId = session.user.id;
    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername) {
      return { error: 'El nombre de usuario es obligatorio.' };
    }

    // Check username uniqueness
    const existingUsername = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
        id: { not: userId }
      }
    });

    if (existingUsername) {
      return { error: 'El nombre de usuario ya está en uso.' };
    }

    const email = data.email?.trim() || `${cleanUsername}@polla.local`;
    
    // Check email uniqueness
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId }
      }
    });

    if (existingEmail) {
      return { error: 'El correo electrónico ya está en uso.' };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update User
      await tx.user.update({
        where: { id: userId },
        data: {
          name: data.name.trim(),
          username: cleanUsername,
          displayUsername: cleanUsername,
          displayName: data.name.trim(),
          email,
          whatsapp: data.whatsapp?.trim() || null,
        }
      });

      // 2. Update Account mapping (if it exists)
      const account = await tx.account.findFirst({
        where: { userId, providerId: 'email' }
      });
      if (account) {
        await tx.account.update({
          where: { id: account.id },
          data: {
            accountId: email
          }
        });
      }
    });

    revalidatePath('/perfil');
    revalidatePath('/cuenta');
    revalidatePath('/ranking');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error updating profile settings:', error);
    return { error: 'Ocurrió un error al actualizar la información de tu perfil.' };
  }
}

export async function updateThemeAction(themeMode: 'black' | 'dark' | 'light') {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const userId = session.user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { themeMode },
    });

    const cookieStore = await cookies();
    cookieStore.set('themeMode', themeMode, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false, // Allow client access to synchronize state if needed
      sameSite: 'lax',
    });

    revalidatePath('/perfil');
    revalidatePath('/cuenta');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error in updateThemeAction:', error);
    return { error: 'Ocurrió un error al actualizar el tema visual.' };
  }
}
