import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { env } from './config/env';
import { HttpError, handleError, nestErrorResponse } from './lib/errors';
import { authRoutes } from './routes/auth';
import { productsRoutes } from './routes/products';
import { blogRoutes } from './routes/blog';
import { releasesRoutes } from './routes/releases';
import { bandsRoutes } from './routes/bands';
import { radioRoutes } from './routes/radio';
import { usersRoutes } from './routes/users';

const app = new Elysia()
  .use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
      exposeHeaders: ['Content-Length', 'Content-Range'],
    }),
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Demo Tapes API',
          version: '1.0.0',
          description: 'Backend API for Demo Tapes',
        },
        tags: [
          { name: 'auth', description: 'Authentication' },
          { name: 'products', description: 'Products catalog' },
          { name: 'blog', description: 'Blog posts' },
          { name: 'releases', description: 'Upcoming releases' },
          { name: 'bands', description: 'Bands catalog' },
          { name: 'radio', description: 'Public radio endpoints' },
          { name: 'radio-admin', description: 'Radio admin endpoints' },
          { name: 'users', description: 'User profile' },
        ],
      },
      path: '/swagger',
    }),
  )
  .onError(({ error, set, code }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      let message = 'Validation failed';
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message) as {
            summary?: string;
            message?: string;
            errors?: Array<{ message?: string; summary?: string }>;
          };
          message =
            parsed.summary ||
            parsed.errors?.[0]?.summary ||
            parsed.errors?.[0]?.message ||
            parsed.message ||
            message;
        } catch {
          message = error.message;
        }
      }
      return nestErrorResponse(400, message);
    }

    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return nestErrorResponse(error.statusCode, error.message);
    }

    if (error instanceof Error && error.message === 'Session not found or does not belong to user') {
      set.status = 404;
      return nestErrorResponse(404, error.message);
    }

    console.error(error);
    set.status = 500;
    return handleError(error);
  })
  .use(authRoutes)
  .use(productsRoutes)
  .use(blogRoutes)
  .use(releasesRoutes)
  .use(bandsRoutes)
  .use(radioRoutes)
  .use(usersRoutes)
  .get('/', () => ({ status: 'ok', message: 'Demo Tapes API' }))
  .listen(env.port);

console.log(`🚀 Demo Tapes API is running on: http://localhost:${app.server?.port}`);

export type App = typeof app;
