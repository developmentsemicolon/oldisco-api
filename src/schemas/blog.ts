import { t } from 'elysia';

export const CreateBlogPostSchema = t.Object({
  slug: t.String(),
  title: t.String(),
  excerpt: t.String(),
  content: t.String(),
  image: t.Optional(t.String()),
  date: t.Optional(t.String()),
});

export const UpdateBlogPostSchema = t.Partial(CreateBlogPostSchema);

export type CreateBlogPostDto = typeof CreateBlogPostSchema.static;
export type UpdateBlogPostDto = typeof UpdateBlogPostSchema.static;
