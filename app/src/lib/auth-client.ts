import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        displayName: { type: 'string', required: false },
        whatsapp: { type: 'string', required: false },
        isSuperadmin: { type: 'boolean', required: false },
      },
    }),
  ],
});

