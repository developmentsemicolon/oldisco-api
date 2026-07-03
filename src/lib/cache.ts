import { env } from '../config/env';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

function getTtlSeconds(ttl?: number): number {
  return ttl ?? env.cacheTtl;
}

export const cache = {
  async get<T>(key: string): Promise<T | undefined> {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value as T;
  },

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    store.set(key, {
      value,
      expiresAt: Date.now() + getTtlSeconds(ttl) * 1000,
    });
  },

  async del(key: string): Promise<void> {
    store.delete(key);
  },

  async reset(): Promise<void> {
    store.clear();
  },

  async getProducts(): Promise<unknown[] | undefined> {
    return this.get<unknown[]>('products:all');
  },

  async setProducts(products: unknown[], ttl?: number): Promise<void> {
    await this.set('products:all', products, ttl);
  },

  async invalidateProducts(): Promise<void> {
    await this.del('products:all');
  },

  async getBlogPosts(): Promise<unknown[] | undefined> {
    return this.get<unknown[]>('blog:all');
  },

  async setBlogPosts(posts: unknown[], ttl?: number): Promise<void> {
    await this.set('blog:all', posts, ttl);
  },

  async invalidateBlogPosts(): Promise<void> {
    await this.del('blog:all');
  },

  async getReleases(): Promise<unknown[] | undefined> {
    return this.get<unknown[]>('releases:all');
  },

  async setReleases(releases: unknown[], ttl?: number): Promise<void> {
    await this.set('releases:all', releases, ttl);
  },

  async invalidateReleases(): Promise<void> {
    await this.del('releases:all');
  },
};
