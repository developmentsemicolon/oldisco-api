import { t } from 'elysia';

export const CreateBandSchema = t.Object({
  name: t.String(),
  genre: t.String(),
  description: t.Optional(t.String()),
  logo: t.Optional(t.String()),
});

export const UpdateBandSchema = t.Partial(CreateBandSchema);

export type CreateBandDto = typeof CreateBandSchema.static;
export type UpdateBandDto = typeof UpdateBandSchema.static;
