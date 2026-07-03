import { Elysia } from 'elysia';
import { env } from '../config/env';
import { authService } from '../services/auth.service';
import { sessionsService } from '../services/sessions.service';
import { authPlugin } from '../plugins/auth';
import {
  LoginSchema,
  RegisterSchema,
  GoogleExchangeSchema,
  ChangePasswordSchema,
  UpdateProfileSchema,
  UpdateNotificationsSchema,
} from '../schemas/auth';

export const authRoutes = new Elysia({ prefix: '/auth', tags: ['auth'] })
  .use(authPlugin)
  .post(
    '/google/exchange',
    async ({ body }) => {
      console.log('[AuthController] Exchanging Google authorization code');
      return authService.exchangeGoogleCode(body.code);
    },
    { body: GoogleExchangeSchema },
  )
  .get('/profile', ({ tokenPayload }) => authService.getProfile(tokenPayload!.sub), {
    requireTokenPayload: true,
  })
  .put(
    '/change-password',
    ({ tokenPayload, body }) => authService.changePassword(tokenPayload!.sub, body),
    { body: ChangePasswordSchema, requireTokenPayload: true },
  )
  .patch(
    '/update-profile',
    ({ tokenPayload, body }) => authService.updateProfile(tokenPayload!.sub, body),
    { body: UpdateProfileSchema, requireTokenPayload: true },
  )
  .patch(
    '/notifications',
    ({ tokenPayload, body, request }) => {
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      return authService.updateNotifications(tokenPayload!.sub, body, userAgent);
    },
    { body: UpdateNotificationsSchema, requireTokenPayload: true },
  )
  .post('/register', ({ body }) => authService.register(body), { body: RegisterSchema })
  .post('/login', ({ body, request }) => {
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    return authService.loginWithSession(body, { userAgent, ipAddress });
  }, { body: LoginSchema })
  .get('/google', () => {
    if (!env.google.clientId || !env.google.callbackUrl) {
      throw new Error('Google OAuth credentials are not configured');
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', env.google.clientId);
    url.searchParams.set('redirect_uri', env.google.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email profile');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');

    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  })
  .get('/google/callback', async ({ query, request }) => {
    const code = query.code;
    if (!code) {
      return Response.redirect(`${env.frontendUrl}/auth/login?error=no_code`, 302);
    }

    try {
      const result = await authService.exchangeGoogleCode(code);
      const user = result.user;

      const userAgent = request.headers.get('user-agent') || undefined;
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined;

      const token = await authService.getJwtAuth(
        { id: user.id, email: user.email },
        { userAgent, ipAddress },
      );

      const userData: Record<string, string> = {
        id: user.id,
        email: user.email,
        name: user.name || '',
        avatar: user.avatar || '',
        role: user.role || 'USER',
        onboardingCompleted: user.onboardingCompleted ? 'true' : 'false',
        token,
      };

      const redirectUrl = new URL(`${env.frontendUrl}/auth/callback`);
      Object.entries(userData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          redirectUrl.searchParams.append(key, value.toString());
        }
      });

      return Response.redirect(redirectUrl.toString(), 302);
    } catch {
      return Response.redirect(`${env.frontendUrl}/auth/login?error=invalid_user`, 302);
    }
  })
  .get('/me', ({ user }) => user!, { requireAuth: true })
  .post('/logout', ({ user, token }) => authService.logout(user!.id, token || undefined), {
    requireAuth: true,
  })
  .get('/sessions', ({ user, token }) => {
    const tokenHash = token ? sessionsService.hashToken(token) : undefined;
    return sessionsService.getUserSessions(user!.id, tokenHash);
  }, { requireAuth: true })
  .delete('/sessions/:sessionId', ({ user, params }) =>
    sessionsService.revokeSession(user!.id, params.sessionId),
  { requireAuth: true })
  .delete('/sessions', async ({ user, token }) => {
    const tokenHash = token ? sessionsService.hashToken(token) : undefined;
    const sessions = await sessionsService.getUserSessions(user!.id, tokenHash);
    const currentSession = sessions.find((s) => s.isCurrent);
    return sessionsService.revokeAllSessions(user!.id, currentSession?.id);
  }, { requireAuth: true })
  .delete('/onesignal/:playerId', ({ user, params }) =>
    authService.removeOneSignalPlayerId(user!.id, params.playerId),
  { requireAuth: true });
