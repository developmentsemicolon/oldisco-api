import { prisma } from '../lib/prisma';
import { cache } from '../lib/cache';
import { HttpError } from '../lib/errors';
import type { CreateBlogPostDto, UpdateBlogPostDto } from '../schemas/blog';

export const blogService = {
  async create(createBlogPostDto: CreateBlogPostDto, authorId: string) {
    const post = await prisma.blogPost.create({
      data: {
        ...createBlogPostDto,
        authorId,
        date: createBlogPostDto.date ? new Date(createBlogPostDto.date) : new Date(),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
    await cache.invalidateBlogPosts();
    return post;
  },

  async findAll() {
    const cachedPosts = await cache.getBlogPosts();
    if (cachedPosts) return cachedPosts;

    const posts = await prisma.blogPost.findMany({
      orderBy: { date: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await cache.setBlogPosts(posts);
    return posts;
  },

  async findOne(slug: string) {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    if (!post) {
      throw new HttpError(404, 'Blog post not found', 'Not Found');
    }

    return post;
  },

  async update(slug: string, updateBlogPostDto: UpdateBlogPostDto) {
    await this.findOne(slug);

    const post = await prisma.blogPost.update({
      where: { slug },
      data: {
        ...updateBlogPostDto,
        ...(updateBlogPostDto.date && { date: new Date(updateBlogPostDto.date) }),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await cache.invalidateBlogPosts();
    return post;
  },

  async remove(slug: string) {
    await this.findOne(slug);
    const post = await prisma.blogPost.delete({ where: { slug } });
    await cache.invalidateBlogPosts();
    return post;
  },
};
