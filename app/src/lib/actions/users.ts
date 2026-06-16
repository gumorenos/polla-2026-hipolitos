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

    // Update User profile details ONLY (DO NOT touch login email or account mappings)
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name.trim(),
        username: cleanUsername,
        displayUsername: cleanUsername,
        displayName: data.name.trim(),
        whatsapp: data.whatsapp?.trim() || null,
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

export async function updateReminderPreferencesAction(
  emailRemindersEnabled: boolean,
  reminderEmail: string | null,
  reminderEmailConfirm?: string | null
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const userId = session.user.id;
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return { error: 'Usuario no encontrado' };
    }

    const cleanEmail = reminderEmail?.trim() || null;
    const cleanConfirm = reminderEmailConfirm?.trim() || null;

    if (emailRemindersEnabled) {
      if (!cleanEmail) {
        return { error: 'El correo electrónico para recordatorios es requerido.' };
      }
      if (cleanEmail !== cleanConfirm) {
        return { error: 'Los correos no coinciden.' };
      }
      if (!cleanEmail.includes('@')) {
        return { error: 'El correo electrónico no es válido.' };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        reminderEmail: cleanEmail,
        remindersEnabled: emailRemindersEnabled,
        emailRemindersEnabled,
        reminderEmailConfirmedAt: cleanEmail ? new Date() : null,
      },
    });

    revalidatePath('/perfil');
    revalidatePath('/cuenta');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error in updateReminderPreferencesAction:', error);
    return { error: 'Ocurrió un error al actualizar tus preferencias de recordatorios.' };
  }
}
