import { Elysia } from 'elysia';
import { usersService } from '../services/users.service';
import { authPlugin } from '../plugins/auth';

export const usersRoutes = new Elysia({ prefix: '/users', tags: ['users'] })
  .use(authPlugin)
  .get('/me', ({ user }) => usersService.findOne(user!.id), { requireAuth: true });
