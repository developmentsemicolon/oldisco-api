import { Elysia, t } from 'elysia';
import { zinesService } from '../services/zines.service';
import { cloudinaryService } from '../services/cloudinary.service';
import { authPlugin } from '../plugins/auth';
import { requireAdminRole } from '../plugins/admin';
import { CreateZineSchema, UpdateZineSchema } from '../schemas/zines';
import { toUploadFile } from '../lib/upload-file';

export const zinesRoutes = new Elysia({ prefix: '/zines', tags: ['zines'] })
  .use(authPlugin)
  .post(
    '/upload-image',
    async ({ user, body }) => {
      requireAdminRole(user);
      const file = await toUploadFile(body.image);
      const { url } = await cloudinaryService.uploadZineImage(file);
      return { url };
    },
    {
      requireAuth: true,
      body: t.Object({ image: t.File() }),
    },
  )
  .post(
    '/',
    ({ user, body }) => {
      requireAdminRole(user);
      return zinesService.create(body);
    },
    { body: CreateZineSchema, requireAuth: true },
  )
  .get(
    '/',
    ({ query }) => zinesService.findAll(query.published === 'true'),
    {
      query: t.Object({
        published: t.Optional(t.String()),
      }),
    },
  )
  .get('/:slug', ({ params }) => zinesService.findOne(params.slug))
  .patch(
    '/:slug',
    ({ user, params, body }) => {
      requireAdminRole(user);
      return zinesService.update(params.slug, body);
    },
    { body: UpdateZineSchema, requireAuth: true },
  )
  .delete(
    '/:slug',
    ({ user, params }) => {
      requireAdminRole(user);
      return zinesService.remove(params.slug);
    },
    { requireAuth: true },
  );
