import axios from 'axios';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { signToken } from '../lib/jwt';
import { env } from '../config/env';
import { hashingService } from './hashing.service';
import { sessionsService } from './sessions.service';
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateNotificationsDto,
  UpdateProfileDto,
} from '../schemas/auth';

export interface GoogleUserObject {
  email: string;
  firstName: string;
  lastName: string;
  googleId: string;
}

export const authService = {
  async validateOAuthLogin(profile: {
    name?: string;
    email: string;
    google_id: string;
    avatarUrl?: string | null;
  }) {
    const nameParts = profile.name ? profile.name.split(' ') : ['', ''];
    const user: GoogleUserObject = {
      email: profile.email,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      googleId: profile.google_id,
    };

    const nUser = await this.validateOrCreateGoogleUser(user);

    const token = await signToken({
      sub: nUser.id,
      name: nUser.name,
      avatarUrl: nUser.avatar,
      email: nUser.email,
      role: nUser.role,
    });

    return { token, user: nUser };
  },

  async exchangeGoogleCode(code: string) {
    try {
      const tokenParams = new URLSearchParams({
        client_id: env.google.clientId!,
        client_secret: env.google.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: env.google.callbackUrl!,
      });

      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        tokenParams,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 10000,
        },
      );

      const tokens = tokenResponse.data;
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const profile = profileResponse.data;
      if (!profile.id || !profile.email) {
        throw new Error('Invalid profile data received from Google');
      }

      return this.validateOAuthLogin({
        google_id: profile.id,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        avatarUrl: profile.picture || null,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data) {
          const errorData = error.response.data as {
            error?: string;
            error_description?: string;
          };
          if (errorData.error && errorData.error_description) {
            throw new Error(
              `Google OAuth error: ${errorData.error} - ${errorData.error_description}`,
            );
          }
          throw new Error(
            `Google OAuth error: HTTP ${error.response.status} - ${JSON.stringify(errorData)}`,
          );
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('Google OAuth request timed out');
        }
        throw new Error(`Google OAuth request failed: ${error.message}`);
      }
      throw error;
    }
  },

  async register(registerDto: RegisterDto) {
    const { email, password, name, role } = registerDto;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new HttpError(409, 'Email já está em uso', 'Conflict');
    }

    const hashedPassword = await hashingService.hash(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'USER',
        emailVerified: false,
        onboardingCompleted: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        emailVerified: true,
        onboardingCompleted: true,
      },
    });

    const token = await signToken({ sub: user.id, email: user.email, role: user.role });
    return { user, token };
  },

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new HttpError(401, 'Credenciais inválidas', 'Unauthorized');
    }

    const passwordIsValid = await hashingService.compare(password, user.password);
    if (!passwordIsValid) {
      throw new HttpError(401, 'Credenciais inválidas', 'Unauthorized');
    }

    if (!user.emailVerified) {
      throw new HttpError(401, 'Email não verificado', 'Unauthorized');
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
      token,
    };
  },

  async loginWithSession(
    loginDto: LoginDto,
    metadata?: { userAgent?: string; ipAddress?: string },
  ) {
    const result = await this.login(loginDto);

    try {
      await sessionsService.createSession(
        result.user.id,
        result.token,
        env.jwt.jwtTtl,
        metadata,
      );
    } catch (error) {
      console.error('Error creating session:', error);
    }

    return result;
  },

  async validateOrCreateGoogleUser(user: GoogleUserObject) {
    let existingUser = await prisma.user.findFirst({
      where: { googleId: user.googleId },
    });

    if (!existingUser) {
      existingUser = await prisma.user.findFirst({
        where: { email: user.email },
      });

      if (existingUser) {
        existingUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId: user.googleId,
            emailVerified: true,
          },
        });
      } else {
        existingUser = await prisma.user.create({
          data: {
            googleId: user.googleId,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
            emailVerified: true,
            onboardingCompleted: false,
            role: 'USER',
          },
        });
      }
    } else {
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
        },
      });
    }

    return existingUser;
  },

  async getJwtAuth(
    { id, email }: { id: string; email: string },
    metadata?: { userAgent?: string; ipAddress?: string },
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new HttpError(404, 'User not found', 'Not Found');
    }

    const token = await signToken({
      sub: id,
      email,
      role: user.role,
    });

    if (metadata) {
      try {
        await sessionsService.createSession(id, token, env.jwt.jwtTtl, metadata);
      } catch (error) {
        console.error('Error creating session for OAuth:', error);
      }
    }

    return token;
  },

  async getProfile(userId: string) {
    const userWithPassword = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!userWithPassword) {
      throw new HttpError(404, 'User not found', 'Not Found');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        emailVerified: true,
        onboardingCompleted: true,
        emailNotifications: true,
        pushNotifications: true,
        oneSignalPlayerId: true,
        notificationSettings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new HttpError(404, 'User not found', 'Not Found');
    }

    return { ...user, hasPassword: !!userWithPassword.password };
  },

  async logout(userId: string, token?: string) {
    if (token) {
      try {
        await sessionsService.revokeSessionByToken(userId, token);
      } catch (error) {
        console.error('Error revoking session on logout:', error);
      }
    }

    return { message: 'Logout realizado com sucesso' };
  },

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(404, 'User not found', 'Not Found');
    }

    if (changePasswordDto.new_password !== changePasswordDto.confirm_password) {
      throw new HttpError(400, 'Passwords do not match', 'Bad Request');
    }

    const userHasPassword = !!user.password;
    const currentUserPassword = user.password;

    if (userHasPassword && currentUserPassword) {
      if (!changePasswordDto.current_password) {
        throw new HttpError(400, 'Current password is required', 'Bad Request');
      }

      const isCurrentPasswordValid = await hashingService.compare(
        changePasswordDto.current_password,
        currentUserPassword,
      );

      if (!isCurrentPasswordValid) {
        throw new HttpError(400, 'Current password is incorrect', 'Bad Request');
      }

      const isSamePassword = await hashingService.compare(
        changePasswordDto.new_password,
        currentUserPassword,
      );

      if (isSamePassword) {
        throw new HttpError(
          400,
          'New password must be different from current password',
          'Bad Request',
        );
      }
    }

    const hashedPassword = await hashingService.hash(changePasswordDto.new_password);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      message: userHasPassword ? 'Password changed successfully' : 'Password set successfully',
    };
  },

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const updateData: { name?: string; email?: string; avatar?: string } = {};

    if (updateProfileDto.name) updateData.name = updateProfileDto.name;

    if (updateProfileDto.email) {
      const existingUser = await prisma.user.findFirst({
        where: { email: updateProfileDto.email, NOT: { id: userId } },
      });

      if (existingUser) {
        throw new HttpError(409, 'Email already in use', 'Conflict');
      }

      updateData.email = updateProfileDto.email;
    }

    if (updateProfileDto.avatar) updateData.avatar = updateProfileDto.avatar;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        emailVerified: true,
        onboardingCompleted: true,
      },
    });

    return { message: 'Profile updated successfully', user };
  },

  async updateNotifications(
    userId: string,
    updateNotificationsDto: UpdateNotificationsDto,
    userAgent?: string,
  ) {
    const updateData: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      oneSignalPlayerId?: string | null;
      notificationSettings?: { deviceInfo: { userAgent: string; registeredAt: string; lastActiveAt: string } };
    } = {};

    if (updateNotificationsDto.emailNotifications !== undefined) {
      updateData.emailNotifications = updateNotificationsDto.emailNotifications;
    }

    if (updateNotificationsDto.pushNotifications !== undefined) {
      updateData.pushNotifications = updateNotificationsDto.pushNotifications;

      if (
        updateNotificationsDto.pushNotifications &&
        updateNotificationsDto.oneSignalPlayerId
      ) {
        updateData.oneSignalPlayerId = updateNotificationsDto.oneSignalPlayerId;
        updateData.notificationSettings = {
          deviceInfo: {
            userAgent: userAgent || 'Unknown',
            registeredAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          },
        };
      }

      if (!updateNotificationsDto.pushNotifications) {
        updateData.oneSignalPlayerId = null;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        emailNotifications: true,
        pushNotifications: true,
        oneSignalPlayerId: true,
      },
    });

    return { message: 'Notificações atualizadas com sucesso', user };
  },

  async removeOneSignalPlayerId(userId: string, playerId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, oneSignalPlayerId: true },
    });

    if (!user) {
      throw new HttpError(404, 'User not found', 'Not Found');
    }

    if (user.oneSignalPlayerId !== playerId) {
      throw new HttpError(403, 'Player ID does not belong to this user', 'Forbidden');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { oneSignalPlayerId: null },
    });

    return { message: 'Player ID removido com sucesso' };
  },
};
