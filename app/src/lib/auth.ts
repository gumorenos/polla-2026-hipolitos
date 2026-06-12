import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      displayName: {
        type: 'string',
        required: false,
      },
      whatsapp: {
        type: 'string',
        required: false,
      },
      isSuperadmin: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    },
  },
});
