import { describe, expect, it } from 'vitest';
import {
  decryptProviderApiKey,
  encryptProviderApiKey,
  isProviderEncryptionConfigured,
  maskProviderApiKey,
} from './provider-secrets';
import { readProviderQuota } from './provider-diagnostics';

const SECRET = 'test-only-provider-encryption-secret-32-chars';

describe('provider API key security', () => {
  it('encrypts and decrypts without storing plaintext', () => {
    const encrypted = encryptProviderApiKey('sk_example_secret_1234', SECRET);
    expect(encrypted).not.toContain('sk_example_secret_1234');
    expect(decryptProviderApiKey(encrypted, SECRET)).toBe('sk_example_secret_1234');
  });

  it('requires a sufficiently long encryption secret', () => {
    expect(isProviderEncryptionConfigured('short')).toBe(false);
    expect(() => encryptProviderApiKey('secret-key', 'short')).toThrow();
  });

  it('masks all but a small prefix and suffix', () => {
    expect(maskProviderApiKey('sk_example_secret_1234')).toBe('sk_...1234');
  });

  it('reads The Odds API quota headers', () => {
    const quota = readProviderQuota('the-odds-api', new Headers({
      'x-requests-remaining': '490',
      'x-requests-used': '10',
      'x-requests-last': '1',
    }));
    expect(quota.requestsRemaining).toBe(490);
    expect(quota.requestsUsed).toBe(10);
    expect(quota.lastRequestCost).toBe(1);
  });

  it('reads Football-Data quota headers', () => {
    const quota = readProviderQuota('football-data', new Headers({
      'X-RequestsAvailable': '9',
      'X-RequestCounter-Reset': '55',
    }));
    expect(quota.requestsRemaining).toBe(9);
    expect(quota.resetInSeconds).toBe(55);
  });
});
