function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined in environment variables`);
  }
  return value;
}

function optional(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  cacheTtl: parseInt(process.env.CACHE_TTL || '900', 10),
  jwt: {
    secret: required('JWT_SECRET'),
    audience: optional('JWT_AUDIENCE'),
    issuer: optional('JWT_ISSUER'),
    jwtTtl: process.env.JWT_EXPIRES_IN || '7d',
  },
  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    callbackUrl: optional('GOOGLE_CALLBACK_URL'),
  },
  cloudinary: {
    cloudName: optional('CLOUDINARY_CLOUD_NAME'),
    apiKey: optional('CLOUDINARY_API_KEY'),
    apiSecret: optional('CLOUDINARY_API_SECRET'),
  },
  r2: {
    accountId: optional('R2_ACCOUNT_ID'),
    accessKeyId: optional('R2_ACCESS_KEY_ID'),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY'),
    endpoint: optional('R2_ENDPOINT'),
    bucketName: process.env.R2_BUCKET_NAME || 'demotapes-radio',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
  productMaxImageSize: parseInt(process.env.PRODUCT_MAX_IMAGE_SIZE || '10485760', 10),
  productAllowedImageTypes: (
    process.env.PRODUCT_ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp'
  ).split(','),
  radioMaxFileSize: parseInt(process.env.RADIO_MAX_FILE_SIZE || '52428800', 10),
  radioAllowedMimeTypes: (
    process.env.RADIO_ALLOWED_MIME_TYPES || 'audio/mpeg,audio/ogg,audio/mp4,audio/wav'
  ).split(','),
};
