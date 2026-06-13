import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields, usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    usernameClient(),
    inferAdditionalFields({
      user: {
        displayName: { type: 'string', required: false },
        displayUsername: { type: 'string', required: false },
        status: { type: 'string', required: false },
        canCreateLeagues: { type: 'boolean', required: false },
        whatsapp: { type: 'string', required: false },
        isSuperadmin: { type: 'boolean', required: false },
      },
    }),
  ],
});

