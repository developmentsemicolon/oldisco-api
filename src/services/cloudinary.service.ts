import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import type { UploadFile } from '../lib/upload-file';

if (env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

export const cloudinaryService = {
  maxImageSize: env.productMaxImageSize,
  allowedImageMimeTypes: env.productAllowedImageTypes,

  validateImageFile(file: UploadFile): void {
    if (!file) {
      throw new HttpError(400, 'Image file is required', 'Bad Request');
    }

    if (file.size > this.maxImageSize) {
      throw new HttpError(
        400,
        `Image size exceeds maximum allowed size of ${this.maxImageSize / 1024 / 1024}MB`,
        'Bad Request',
      );
    }

    if (!this.allowedImageMimeTypes.includes(file.mimetype)) {
      throw new HttpError(
        400,
        `Image type ${file.mimetype} is not allowed. Allowed types: ${this.allowedImageMimeTypes.join(', ')}`,
        'Bad Request',
      );
    }
  },

  generateProductImageKey(originalName: string): string {
    const ext = extname(originalName);
    return `demotapes/products/${uuidv4()}${ext}`;
  },

  generateBlogImageKey(originalName: string): string {
    const ext = extname(originalName);
    return `demotapes/blog/${uuidv4()}${ext}`;
  },

  generateReleaseImageKey(originalName: string): string {
    const ext = extname(originalName);
    return `demotapes/releases/${uuidv4()}${ext}`;
  },

  async uploadImage(
    file: UploadFile,
    folder: string,
    generateKey: (name: string) => string,
  ): Promise<{ key: string; url: string }> {
    this.validateImageFile(file);

    const publicId = generateKey(file.originalname).replace(/\.[^/.]+$/, '');

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder,
          resource_type: 'image',
          quality: 'auto:good',
          fetch_format: 'auto',
          flags: ['progressive'],
          transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            reject(new HttpError(400, `Failed to upload image: ${error.message}`, 'Bad Request'));
          } else if (!result) {
            reject(new HttpError(400, 'Failed to upload image: No result returned', 'Bad Request'));
          } else {
            resolve({ key: result.public_id, url: result.secure_url });
          }
        },
      );

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  },

  uploadProductImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/products', this.generateProductImageKey.bind(this));
  },

  uploadBlogImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/blog', this.generateBlogImageKey.bind(this));
  },

  uploadReleaseImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/releases', this.generateReleaseImageKey.bind(this));
  },

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpError(400, `Failed to delete image: ${message}`, 'Bad Request');
    }
  },
};
