import { t } from 'elysia';

const TracklistSchema = t.Object({
  sideA: t.Array(t.String()),
  sideB: t.Optional(t.Array(t.String())),
});

export const CreateProductSchema = t.Object({
  band: t.String(),
  album: t.String(),
  genre: t.String(),
  year: t.Number(),
  price: t.Number({ minimum: 0 }),
  stock: t.Number({ minimum: 0 }),
  description: t.Optional(t.String()),
  available: t.Optional(t.Boolean()),
  tracklist: t.Optional(TracklistSchema),
  catalogNumber: t.Optional(t.String()),
});

export const UpdateProductSchema = t.Partial(CreateProductSchema);

export type CreateProductDto = typeof CreateProductSchema.static;
export type UpdateProductDto = typeof UpdateProductSchema.static;
