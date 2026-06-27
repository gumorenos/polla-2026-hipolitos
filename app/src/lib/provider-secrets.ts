import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ENCRYPTION_VERSION = 'v1';
const IV_BYTES = 12;
const MINIMUM_SECRET_LENGTH = 32;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function isProviderEncryptionConfigured(
  secret = process.env.API_KEYS_ENCRYPTION_SECRET,
): boolean {
  return typeof secret === 'string' && secret.trim().length >= MINIMUM_SECRET_LENGTH;
}

export function encryptProviderApiKey(
  apiKey: string,
  secret = process.env.API_KEYS_ENCRYPTION_SECRET,
): string {
  if (!isProviderEncryptionConfigured(secret)) {
    throw new Error('API_KEYS_ENCRYPTION_SECRET no está configurado correctamente.');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret!), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptProviderApiKey(
  encryptedApiKey: string,
  secret = process.env.API_KEYS_ENCRYPTION_SECRET,
): string {
  if (!isProviderEncryptionConfigured(secret)) {
    throw new Error('API_KEYS_ENCRYPTION_SECRET no está configurado correctamente.');
  }

  const [version, ivValue, authTagValue, ciphertextValue] = encryptedApiKey.split(':');
  if (
    version !== ENCRYPTION_VERSION ||
    !ivValue ||
    !authTagValue ||
    !ciphertextValue
  ) {
    throw new Error('El formato de la credencial cifrada no es válido.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret!),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskProviderApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  const suffix = trimmed.slice(-4);
  const prefix = trimmed.length > 8 ? trimmed.slice(0, 3) : '';
  return prefix ? `${prefix}...${suffix}` : `...${suffix}`;
}
