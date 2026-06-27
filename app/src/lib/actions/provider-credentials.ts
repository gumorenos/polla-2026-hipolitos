'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '../auth-helpers';
import { prisma } from '../db';
import {
  isProviderId,
  resolveProviderApiKey,
  type ProviderId,
} from '../provider-credentials';
import { testProviderConnection } from '../provider-diagnostics';
import {
  encryptProviderApiKey,
  isProviderEncryptionConfigured,
  maskProviderApiKey,
} from '../provider-secrets';

export type ProviderActionResult = {
  success: boolean;
  message: string;
};

async function getSuperadminUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isSuperadmin: true },
  });
  return user?.isSuperadmin ? user.id : null;
}

function validateProvider(provider: string): ProviderId | null {
  return isProviderId(provider) ? provider : null;
}

export async function saveProviderCredentialAction(
  providerValue: string,
  apiKeyValue: string,
): Promise<ProviderActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const provider = validateProvider(providerValue);
  if (!provider) return { success: false, message: 'Proveedor no válido.' };
  if (!isProviderEncryptionConfigured()) {
    return {
      success: false,
      message: 'Configura API_KEYS_ENCRYPTION_SECRET antes de guardar API keys.',
    };
  }

  const apiKey = apiKeyValue.trim();
  if (apiKey.length < 6) {
    return { success: false, message: 'Ingresa una API key válida.' };
  }

  const encryptedApiKey = encryptProviderApiKey(apiKey);
  const maskedApiKey = maskProviderApiKey(apiKey);

  await prisma.providerCredential.upsert({
    where: { provider },
    create: {
      provider,
      encryptedApiKey,
      maskedApiKey,
      isActive: true,
      updatedByUserId: userId,
    },
    update: {
      encryptedApiKey,
      maskedApiKey,
      isActive: true,
      lastStatus: null,
      lastCheckedAt: null,
      lastError: null,
      lastRequestsRemaining: null,
      lastRequestsUsed: null,
      lastRequestCost: null,
      lastResetAt: null,
      lastResetInSeconds: null,
      updatedByUserId: userId,
    },
  });

  revalidatePath('/admin/odds');
  return { success: true, message: 'API key guardada de forma cifrada.' };
}

export async function testProviderConnectionAction(
  providerValue: string,
): Promise<ProviderActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const provider = validateProvider(providerValue);
  if (!provider) return { success: false, message: 'Proveedor no válido.' };

  const credential = await resolveProviderApiKey(provider);
  if (!credential.apiKey) {
    return { success: false, message: 'Proveedor no configurado.' };
  }

  const checkedAt = new Date();
  const diagnostic = await testProviderConnection(provider, credential.apiKey);
  await prisma.providerCredential.upsert({
    where: { provider },
    create: {
      provider,
      isActive: false,
      lastStatus: diagnostic.status,
      lastCheckedAt: checkedAt,
      lastError: diagnostic.error,
      lastRequestsRemaining: diagnostic.requestsRemaining,
      lastRequestsUsed: diagnostic.requestsUsed,
      lastRequestCost: diagnostic.lastRequestCost,
      lastResetAt: diagnostic.resetAt,
      lastResetInSeconds: diagnostic.resetInSeconds,
      updatedByUserId: userId,
    },
    update: {
      lastStatus: diagnostic.status,
      lastCheckedAt: checkedAt,
      lastError: diagnostic.error,
      lastRequestsRemaining: diagnostic.requestsRemaining,
      lastRequestsUsed: diagnostic.requestsUsed,
      lastRequestCost: diagnostic.lastRequestCost,
      lastResetAt: diagnostic.resetAt,
      lastResetInSeconds: diagnostic.resetInSeconds,
      updatedByUserId: userId,
    },
  });

  revalidatePath('/admin/odds');
  return diagnostic.success
    ? { success: true, message: 'Conexión exitosa.' }
    : { success: false, message: diagnostic.error ?? 'La API key no pudo validarse.' };
}

export async function deactivateProviderCredentialAction(
  providerValue: string,
): Promise<ProviderActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const provider = validateProvider(providerValue);
  if (!provider) return { success: false, message: 'Proveedor no válido.' };

  await prisma.providerCredential.updateMany({
    where: { provider },
    data: { isActive: false, updatedByUserId: userId },
  });
  revalidatePath('/admin/odds');
  return {
    success: true,
    message: 'Credencial almacenada desactivada. El respaldo por entorno se mantiene.',
  };
}

export async function deleteProviderCredentialAction(
  providerValue: string,
): Promise<ProviderActionResult> {
  const userId = await getSuperadminUserId();
  if (!userId) return { success: false, message: 'Acción no autorizada.' };

  const provider = validateProvider(providerValue);
  if (!provider) return { success: false, message: 'Proveedor no válido.' };

  await prisma.providerCredential.updateMany({
    where: { provider },
    data: {
      encryptedApiKey: null,
      maskedApiKey: null,
      isActive: false,
      updatedByUserId: userId,
    },
  });
  revalidatePath('/admin/odds');
  return {
    success: true,
    message: 'API key almacenada eliminada. El respaldo por entorno se mantiene.',
  };
}
