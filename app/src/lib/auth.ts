import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { username } from 'better-auth/plugins';
import { prisma } from './db';

const envTrustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const fallbackOrigins = [
  'https://pollahipolitos.todoestaaca.com',
  'http://localhost:3000',
  'http://localhost:3030',
  'http://192.168.100.53:3030',
];

const trustedOrigins = Array.from(new Set([...envTrustedOrigins, ...fallbackOrigins]));

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  trustedOrigins,
  plugins: [
    username(),
  ],
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
      displayUsername: {
        type: 'string',
        required: false,
      },
      status: {
        type: 'string',
        required: false,
        defaultValue: 'pending',
      },
      canCreateLeagues: {
        type: 'boolean',
        required: false,
        defaultValue: false,
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
