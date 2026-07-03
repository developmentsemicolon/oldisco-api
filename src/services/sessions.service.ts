import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export const sessionsService = {
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  },

  extractDeviceInfo(userAgent?: string): string | null {
    if (!userAgent) return null;

    let deviceInfo = '';

    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceInfo += 'Mobile';
    } else {
      deviceInfo += 'Desktop';
    }

    if (userAgent.includes('Chrome')) deviceInfo += ' - Chrome';
    else if (userAgent.includes('Firefox')) deviceInfo += ' - Firefox';
    else if (userAgent.includes('Safari')) deviceInfo += ' - Safari';
    else if (userAgent.includes('Edge')) deviceInfo += ' - Edge';

    if (userAgent.includes('Windows')) deviceInfo += ' (Windows)';
    else if (userAgent.includes('Mac')) deviceInfo += ' (macOS)';
    else if (userAgent.includes('Linux')) deviceInfo += ' (Linux)';
    else if (userAgent.includes('Android')) deviceInfo += ' (Android)';
    else if (userAgent.includes('iOS')) deviceInfo += ' (iOS)';

    return deviceInfo || null;
  },

  calculateExpiration(expiresIn: string): Date {
    const now = Date.now();
    let milliseconds = 0;

    if (expiresIn.endsWith('d')) {
      milliseconds = parseInt(expiresIn.slice(0, -1), 10) * 24 * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('h')) {
      milliseconds = parseInt(expiresIn.slice(0, -1), 10) * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('m')) {
      milliseconds = parseInt(expiresIn.slice(0, -1), 10) * 60 * 1000;
    } else if (expiresIn.endsWith('s')) {
      milliseconds = parseInt(expiresIn.slice(0, -1), 10) * 1000;
    } else {
      milliseconds = 7 * 24 * 60 * 60 * 1000;
    }

    return new Date(now + milliseconds);
  },

  async createSession(
    userId: string,
    token: string,
    expiresIn: string,
    metadata?: SessionMetadata,
  ) {
    const expiresAt = this.calculateExpiration(expiresIn);
    const tokenHash = this.hashToken(token);
    const deviceInfo = this.extractDeviceInfo(metadata?.userAgent);

    await this.cleanupExpiredSessions(userId);

    return prisma.session.create({
      data: {
        userId,
        token: tokenHash,
        userAgent: metadata?.userAgent || null,
        ipAddress: metadata?.ipAddress || null,
        deviceInfo,
        isActive: true,
        lastActivityAt: new Date(),
        expiresAt,
      },
    });
  },

  async getUserSessions(userId: string, currentTokenHash?: string) {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      deviceInfo: session.deviceInfo,
      location: session.location,
      isActive: session.isActive,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      isCurrent: currentTokenHash ? session.token === currentTokenHash : false,
    }));
  },

  async revokeSession(userId: string, sessionId: string) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found or does not belong to user');
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return { message: 'Session revoked successfully' };
  },

  async revokeAllSessions(userId: string, excludeSessionId?: string) {
    const where: {
      userId: string;
      isActive: boolean;
      id?: { not: string };
    } = {
      userId,
      isActive: true,
    };

    if (excludeSessionId) {
      where.id = { not: excludeSessionId };
    }

    await prisma.session.updateMany({
      where,
      data: { isActive: false },
    });

    return { message: 'All sessions revoked successfully' };
  },

  async revokeSessionByToken(userId: string, token: string) {
    const tokenHash = this.hashToken(token);
    const session = await prisma.session.findFirst({
      where: { userId, token: tokenHash, isActive: true },
    });

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isActive: false },
      });
    }
  },

  async cleanupExpiredSessions(userId?: string) {
    const where: {
      OR: Array<{ expiresAt?: { lt: Date }; isActive?: boolean }>;
      userId?: string;
    } = {
      OR: [{ expiresAt: { lt: new Date() } }, { isActive: false }],
    };

    if (userId) {
      where.userId = userId;
    }

    await prisma.session.deleteMany({ where });
  },
};
