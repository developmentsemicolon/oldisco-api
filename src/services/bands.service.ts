import { prisma } from '../lib/prisma';
import { cache } from '../lib/cache';
import { HttpError } from '../lib/errors';
import type { CreateBandDto, UpdateBandDto } from '../schemas/bands';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const bandsService = {
  async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base = slugify(name) || 'banda';
    let slug = base;
    let counter = 1;

    while (true) {
      const existing = await prisma.band.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) break;
      counter += 1;
      slug = `${base}-${counter}`;
    }

    return slug;
  },

  async create(createBandDto: CreateBandDto) {
    const slug = await this.generateUniqueSlug(createBandDto.name);

    const band = await prisma.band.create({
      data: { ...createBandDto, slug },
    });

    await cache.invalidateBands();
    return band;
  },

  async findAll() {
    const cachedBands = await cache.getBands();
    if (cachedBands) return cachedBands;

    const bands = await prisma.band.findMany({
      orderBy: { createdAt: 'desc' },
    });

    await cache.setBands(bands);
    return bands;
  },

  async findOne(slug: string) {
    const band = await prisma.band.findUnique({ where: { slug } });
    if (!band) {
      throw new HttpError(404, 'Band not found', 'Not Found');
    }
    return band;
  },

  async update(slug: string, updateBandDto: UpdateBandDto) {
    const current = await this.findOne(slug);

    const data: UpdateBandDto & { slug?: string } = { ...updateBandDto };
    if (updateBandDto.name && updateBandDto.name !== current.name) {
      data.slug = await this.generateUniqueSlug(updateBandDto.name, current.id);
    }

    const band = await prisma.band.update({ where: { slug }, data });
    await cache.invalidateBands();
    return band;
  },

  async remove(slug: string) {
    await this.findOne(slug);
    const band = await prisma.band.delete({ where: { slug } });
    await cache.invalidateBands();
    return band;
  },
};
