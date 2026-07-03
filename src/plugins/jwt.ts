import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';

export const jwtPlugin = jwt({
  name: 'jwt',
  secret: env.jwt.secret,
  exp: env.jwt.jwtTtl,
  ...(env.jwt.audience ? { aud: env.jwt.audience } : {}),
  ...(env.jwt.issuer ? { iss: env.jwt.issuer } : {}),
});

export const jwtBase = new Elysia({ name: 'jwt-base' }).use(jwtPlugin);
