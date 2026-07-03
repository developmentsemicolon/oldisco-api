import { Elysia, t } from 'elysia';
import { releasesService } from '../services/releases.service';
import { cloudinaryService } from '../services/cloudinary.service';
import { authPlugin } from '../plugins/auth';
import { requireAdminRole } from '../plugins/admin';
import { CreateReleaseSchema, UpdateReleaseSchema } from '../schemas/releases';
import { toUploadFile } from '../lib/upload-file';

export const releasesRoutes = new Elysia({ prefix: '/releases', tags: ['releases'] })
  .use(authPlugin)
  .post(
    '/upload-image',
    async ({ user, body }) => {
      requireAdminRole(user);
      const file = await toUploadFile(body.image);
      const { url } = await cloudinaryService.uploadReleaseImage(file);
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
      return releasesService.create(body);
    },
    { body: CreateReleaseSchema, requireAuth: true },
  )
  .get('/', () => releasesService.findAll())
  .get('/:slug', ({ params }) => releasesService.findOne(params.slug))
  .patch(
    '/:slug',
    ({ user, params, body }) => {
      requireAdminRole(user);
      return releasesService.update(params.slug, body);
    },
    { body: UpdateReleaseSchema, requireAuth: true },
  )
  .delete(
    '/:slug',
    ({ user, params }) => {
      requireAdminRole(user);
      return releasesService.remove(params.slug);
    },
    { requireAuth: true },
  );
