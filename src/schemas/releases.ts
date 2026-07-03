import { t } from 'elysia';

export const CreateReleaseSchema = t.Object({
  slug: t.String(),
  title: t.String(),
  band: t.String(),
  album: t.String(),
  genre: t.String(),
  releaseDate: t.String(),
  description: t.Optional(t.String()),
  image: t.Optional(t.String()),
  status: t.Optional(
    t.Union([t.Literal('ANNOUNCED'), t.Literal('COMING_SOON'), t.Literal('RELEASED')]),
  ),
});

export const UpdateReleaseSchema = t.Partial(CreateReleaseSchema);

export type CreateReleaseDto = typeof CreateReleaseSchema.static;
export type UpdateReleaseDto = typeof UpdateReleaseSchema.static;
