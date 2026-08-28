import { t } from 'elysia';

export const CreateZineSchema = t.Object({
  title: t.String(),
  editionNumber: t.Number(),
  description: t.Optional(t.String()),
  coverImage: t.Optional(t.String()),
  pages: t.Array(t.String()),
  published: t.Optional(t.Boolean()),
});

export const UpdateZineSchema = t.Partial(CreateZineSchema);

export type CreateZineDto = typeof CreateZineSchema.static;
export type UpdateZineDto = typeof UpdateZineSchema.static;
