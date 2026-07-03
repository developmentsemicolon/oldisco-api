import { prisma } from '../lib/prisma';

export const usersService = {
  async findOne(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  },

  async verifyEmail(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  },
};
