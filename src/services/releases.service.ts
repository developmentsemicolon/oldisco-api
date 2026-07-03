import { prisma } from '../lib/prisma';
import { cache } from '../lib/cache';
import { HttpError } from '../lib/errors';
import type { CreateReleaseDto, UpdateReleaseDto } from '../schemas/releases';

export const releasesService = {
  async create(createReleaseDto: CreateReleaseDto) {
    const release = await prisma.upcomingRelease.create({
      data: {
        ...createReleaseDto,
        releaseDate: new Date(createReleaseDto.releaseDate),
      },
    });
    await cache.invalidateReleases();
    return release;
  },

  async findAll() {
    const cachedReleases = await cache.getReleases();
    if (cachedReleases) return cachedReleases;

    const releases = await prisma.upcomingRelease.findMany({
      orderBy: { releaseDate: 'desc' },
    });

    await cache.setReleases(releases);
    return releases;
  },

  async findOne(slug: string) {
    const release = await prisma.upcomingRelease.findUnique({ where: { slug } });
    if (!release) {
      throw new HttpError(404, 'Release not found', 'Not Found');
    }
    return release;
  },

  async update(slug: string, updateReleaseDto: UpdateReleaseDto) {
    await this.findOne(slug);

    const release = await prisma.upcomingRelease.update({
      where: { slug },
      data: {
        ...updateReleaseDto,
        ...(updateReleaseDto.releaseDate && {
          releaseDate: new Date(updateReleaseDto.releaseDate),
        }),
      },
    });

    await cache.invalidateReleases();
    return release;
  },

  async remove(slug: string) {
    await this.findOne(slug);
    const release = await prisma.upcomingRelease.delete({ where: { slug } });
    await cache.invalidateReleases();
    return release;
  },
};
