import { v2 as cloudinary } from 'cloudinary';
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

  async uploadImage(
    file: UploadFile,
    folder: string,
  ): Promise<{ key: string; url: string }> {
    this.validateImageFile(file);

    if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
      throw new HttpError(500, 'Cloudinary is not configured', 'Internal Server Error');
    }

    // Bun + upload_stream treats requests as unsigned; use uploader.upload with data URI instead
    const publicId = uuidv4();
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        public_id: publicId,
        folder,
        resource_type: 'image',
        quality: 'auto:good',
        fetch_format: 'auto',
      });

      return { key: result.public_id, url: result.secure_url };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpError(400, `Failed to upload image: ${message}`, 'Bad Request');
    }
  },

  uploadProductImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/products');
  },

  uploadBlogImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/blog');
  },

  uploadReleaseImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/releases');
  },

  uploadBandImage(file: UploadFile) {
    return this.uploadImage(file, 'demotapes/bands');
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
