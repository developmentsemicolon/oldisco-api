import { prisma } from '../lib/prisma';
import { cache } from '../lib/cache';
import { HttpError } from '../lib/errors';
import type { CreateZineDto, UpdateZineDto } from '../schemas/zines';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const zinesService = {
  async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title) || 'zine';
    let slug = base;
    let counter = 1;

    while (true) {
      const existing = await prisma.zineEdition.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) break;
      counter += 1;
      slug = `${base}-${counter}`;
    }

    return slug;
  },

  async create(createZineDto: CreateZineDto) {
    const slug = await this.generateUniqueSlug(createZineDto.title);

    const zine = await prisma.zineEdition.create({
      data: { ...createZineDto, slug },
    });

    await cache.invalidateZines();
    return zine;
  },

  async findAll(publishedOnly = false) {
    if (!publishedOnly) {
      const cached = await cache.getZines();
      if (cached) return cached;
    }

    const zines = await prisma.zineEdition.findMany({
      where: publishedOnly ? { published: true } : undefined,
      orderBy: { editionNumber: 'desc' },
    });

    if (!publishedOnly) {
      await cache.setZines(zines);
    }

    return zines;
  },

  async findOne(slug: string) {
    const zine = await prisma.zineEdition.findUnique({ where: { slug } });
    if (!zine) {
      throw new HttpError(404, 'Zine edition not found', 'Not Found');
    }
    return zine;
  },

  async update(slug: string, updateZineDto: UpdateZineDto) {
    const current = await this.findOne(slug);

    const data: UpdateZineDto & { slug?: string } = { ...updateZineDto };
    if (updateZineDto.title && updateZineDto.title !== current.title) {
      data.slug = await this.generateUniqueSlug(updateZineDto.title, current.id);
    }

    const zine = await prisma.zineEdition.update({ where: { slug }, data });
    await cache.invalidateZines();
    return zine;
  },

  async remove(slug: string) {
    await this.findOne(slug);
    const zine = await prisma.zineEdition.delete({ where: { slug } });
    await cache.invalidateZines();
    return zine;
  },
};
