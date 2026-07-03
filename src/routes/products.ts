import { Elysia, t } from 'elysia';
import { productsService } from '../services/products.service';
import { adminPlugin } from '../plugins/admin';
import { CreateProductSchema, UpdateProductSchema } from '../schemas/products';
import { toUploadFiles } from '../lib/upload-file';
import { HttpError } from '../lib/errors';

const TracklistSchema = t.Object({
  sideA: t.Array(t.String()),
  sideB: t.Optional(t.Array(t.String())),
});

export const productsRoutes = new Elysia({ prefix: '/products', tags: ['products'] })
  .use(adminPlugin)
  .post(
    '/',
    async ({ body }) => {
      const images = await toUploadFiles(body.images);
      if (images.length === 0) {
        throw new HttpError(400, 'At least one image is required', 'Bad Request');
      }

      let tracklist = body.tracklist;
      if (typeof tracklist === 'string') {
        try {
          tracklist = JSON.parse(tracklist);
        } catch {
          tracklist = undefined;
        }
      }

      return productsService.createWithImages(
        {
          band: body.band,
          album: body.album,
          genre: body.genre,
          year: Number(body.year),
          price: Number(body.price),
          stock: Number(body.stock),
          description: body.description,
          available: body.available === undefined ? undefined : body.available === true || body.available === 'true',
          tracklist,
        },
        images,
      );
    },
    {
      requireAdmin: true,
      body: t.Object({
        band: t.String(),
        album: t.String(),
        genre: t.String(),
        year: t.Union([t.Number(), t.String()]),
        price: t.Union([t.Number(), t.String()]),
        stock: t.Union([t.Number(), t.String()]),
        description: t.Optional(t.String()),
        available: t.Optional(t.Union([t.Boolean(), t.String()])),
        tracklist: t.Optional(t.Union([TracklistSchema, t.String()])),
        images: t.Union([t.File(), t.Array(t.File())]),
      }),
    },
  )
  .get('/', () => productsService.findAll())
  .get('/:id', ({ params }) => productsService.findOne(params.id))
  .patch(
    '/:id',
    ({ params, body }) => productsService.update(params.id, body),
    { body: UpdateProductSchema, requireAdmin: true },
  )
  .delete('/:id', ({ params }) => productsService.remove(params.id), { requireAdmin: true });
