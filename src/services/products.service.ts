import { prisma } from '../lib/prisma';
import { cache } from '../lib/cache';
import { HttpError } from '../lib/errors';
import { cloudinaryService } from './cloudinary.service';
import type { UploadFile } from '../lib/upload-file';
import type { CreateProductDto, UpdateProductDto } from '../schemas/products';

export const productsService = {
  async createWithImages(createProductDto: CreateProductDto, imageFiles: UploadFile[]) {
    const imageUrls: string[] = [];

    for (const file of imageFiles) {
      const { url } = await cloudinaryService.uploadProductImage(file);
      imageUrls.push(url);
    }

    const product = await prisma.product.create({
      data: { ...createProductDto, images: imageUrls },
    });

    await cache.invalidateProducts();
    return product;
  },

  async findAll() {
    const cachedProducts = await cache.getProducts();
    if (cachedProducts) return cachedProducts;

    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    await cache.setProducts(products);
    return products;
  },

  async findOne(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new HttpError(404, 'Product not found', 'Not Found');
    }
    return product;
  },

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);
    const product = await prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
    await cache.invalidateProducts();
    return product;
  },

  async remove(id: string) {
    await this.findOne(id);
    const product = await prisma.product.delete({ where: { id } });
    await cache.invalidateProducts();
    return product;
  },
};
