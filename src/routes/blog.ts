import { Elysia, t } from 'elysia';
import { blogService } from '../services/blog.service';
import { cloudinaryService } from '../services/cloudinary.service';
import { authPlugin } from '../plugins/auth';
import { requireAdminRole } from '../plugins/admin';
import { CreateBlogPostSchema, UpdateBlogPostSchema } from '../schemas/blog';
import { toUploadFile } from '../lib/upload-file';

export const blogRoutes = new Elysia({ prefix: '/blog', tags: ['blog'] })
  .use(authPlugin)
  .post(
    '/upload-image',
    async ({ user, body }) => {
      requireAdminRole(user);
      const file = await toUploadFile(body.image);
      const { url } = await cloudinaryService.uploadBlogImage(file);
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
      return blogService.create(body, user!.id);
    },
    { body: CreateBlogPostSchema, requireAuth: true },
  )
  .get('/', () => blogService.findAll())
  .get('/:slug', ({ params }) => blogService.findOne(params.slug))
  .patch(
    '/:slug',
    ({ user, params, body }) => {
      requireAdminRole(user);
      return blogService.update(params.slug, body);
    },
    { body: UpdateBlogPostSchema, requireAuth: true },
  )
  .delete(
    '/:slug',
    ({ user, params }) => {
      requireAdminRole(user);
      return blogService.remove(params.slug);
    },
    { requireAuth: true },
  );
