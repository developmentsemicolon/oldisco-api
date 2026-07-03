import { Elysia } from 'elysia';
import { HttpError } from '../lib/errors';
import { authPlugin } from './auth';

export const adminPlugin = new Elysia({ name: 'admin' })
  .use(authPlugin)
  .macro('requireAdmin', {
    beforeHandle({ user }) {
      if (!user) {
        throw new HttpError(401, 'Invalid JWT token', 'Unauthorized');
      }
      if (user.role !== 'ADMIN') {
        throw new HttpError(403, 'Only ADMIN users can access this resource', 'Forbidden');
      }
    },
  });

export function requireAdminRole(user: { role: string } | null) {
  if (!user) {
    throw new HttpError(401, 'Invalid JWT token', 'Unauthorized');
  }
  if (user.role !== 'ADMIN') {
    throw new HttpError(403, 'Only ADMIN can access this resource', 'Forbidden');
  }
}
