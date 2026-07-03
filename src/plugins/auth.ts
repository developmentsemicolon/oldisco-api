import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { extractBearerToken, verifyToken } from '../lib/jwt';
import { jwtBase } from './jwt';

export const authPlugin = new Elysia({ name: 'auth' })
  .use(jwtBase)
  .derive({ as: 'global' }, async ({ headers }) => {
    const token = extractBearerToken(headers.authorization);
    if (!token) {
      return { user: null as null | AuthUser, token: null as string | null, tokenPayload: null as TokenPayload | null };
    }

    try {
      const payload = await verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          emailVerified: true,
          onboardingCompleted: true,
        },
      });

      if (!user) {
        return { user: null, token, tokenPayload: null };
      }

      return {
        user,
        token,
        tokenPayload: { ...payload, role: user.role },
      };
    } catch {
      return { user: null, token, tokenPayload: null };
    }
  })
  .macro('requireAuth', {
    beforeHandle({ user }) {
      if (!user) {
        throw new HttpError(401, 'Invalid JWT token', 'Unauthorized');
      }
    },
  })
  .macro('requireTokenPayload', {
    beforeHandle({ tokenPayload }) {
      if (!tokenPayload?.sub) {
        throw new HttpError(401, 'Invalid JWT token', 'Unauthorized');
      }
    },
  });

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
};

export type TokenPayload = {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
};
