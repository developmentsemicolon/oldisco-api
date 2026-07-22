import { Elysia, t } from 'elysia';
import { bandsService } from '../services/bands.service';
import { cloudinaryService } from '../services/cloudinary.service';
import { authPlugin } from '../plugins/auth';
import { requireAdminRole } from '../plugins/admin';
import { CreateBandSchema, UpdateBandSchema } from '../schemas/bands';
import { toUploadFile } from '../lib/upload-file';

export const bandsRoutes = new Elysia({ prefix: '/bands', tags: ['bands'] })
  .use(authPlugin)
  .post(
    '/upload-image',
    async ({ user, body }) => {
      requireAdminRole(user);
      const file = await toUploadFile(body.image);
      const { url } = await cloudinaryService.uploadBandImage(file);
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
      return bandsService.create(body);
    },
    { body: CreateBandSchema, requireAuth: true },
  )
  .get('/', () => bandsService.findAll())
  .get('/:slug', ({ params }) => bandsService.findOne(params.slug))
  .patch(
    '/:slug',
    ({ user, params, body }) => {
      requireAdminRole(user);
      return bandsService.update(params.slug, body);
    },
    { body: UpdateBandSchema, requireAuth: true },
  )
  .delete(
    '/:slug',
    ({ user, params }) => {
      requireAdminRole(user);
      return bandsService.remove(params.slug);
    },
    { requireAuth: true },
  );
