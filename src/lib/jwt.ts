import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env';

const secret = new TextEncoder().encode(env.jwt.secret);

export interface TokenPayload {
  sub: string;
  email?: string;
  role?: string;
  name?: string;
  avatarUrl?: string;
  iat?: number;
  exp?: number;
  aud?: string | string[];
  iss?: string;
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  let token = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' });

  if (env.jwt.audience) {
    token = token.setAudience(env.jwt.audience);
  }

  if (env.jwt.issuer) {
    token = token.setIssuer(env.jwt.issuer);
  }

  return token.setExpirationTime(env.jwt.jwtTtl).sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const options: Parameters<typeof jwtVerify>[2] = {};
  if (env.jwt.audience) options.audience = env.jwt.audience;
  if (env.jwt.issuer) options.issuer = env.jwt.issuer;

  const { payload } = await jwtVerify(token, secret, options);
  return payload as TokenPayload;
}

export function extractBearerToken(authorization?: string | null): string | undefined {
  if (!authorization || typeof authorization !== 'string') return undefined;
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) return undefined;
  return token;
}
