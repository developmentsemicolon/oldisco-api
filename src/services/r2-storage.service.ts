import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { Readable } from 'stream';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import type { UploadFile } from '../lib/upload-file';

function createS3Client(): S3Client {
  if (!env.r2.accessKeyId || !env.r2.secretAccessKey || !env.r2.endpoint) {
    throw new HttpError(500, 'R2 configuration is missing. Please check your .env file.', 'Internal Server Error');
  }

  return new S3Client({
    region: 'auto',
    endpoint: env.r2.endpoint,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

export const r2StorageService = {
  get bucketName() {
    return env.r2.bucketName;
  },
  get publicUrl() {
    return env.r2.publicUrl;
  },
  maxFileSize: env.radioMaxFileSize,
  allowedMimeTypes: env.radioAllowedMimeTypes,

  validateFile(file: UploadFile): void {
    if (!file) {
      throw new HttpError(400, 'File is required', 'Bad Request');
    }

    if (file.size > this.maxFileSize) {
      throw new HttpError(
        400,
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
        'Bad Request',
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new HttpError(
        400,
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
        'Bad Request',
      );
    }
  },

  generateFileKey(originalName: string): string {
    return `radio/${uuidv4()}${extname(originalName)}`;
  },

  async uploadFile(file: UploadFile): Promise<{ key: string; url: string }> {
    this.validateFile(file);
    const key = this.generateFileKey(file.originalname);

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000',
      }),
    );

    const url = this.publicUrl
      ? `${this.publicUrl}/${key}`
      : await this.generatePresignedUrl(key);

    return { key, url };
  },

  async deleteFile(key: string): Promise<void> {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  },

  getPublicUrl(key: string): string {
    return this.publicUrl ? `${this.publicUrl}/${key}` : key;
  },

  async generatePresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      { expiresIn },
    );
  },

  async getFileStream(key: string): Promise<Readable> {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );

    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    return response.Body as Readable;
  },
};
