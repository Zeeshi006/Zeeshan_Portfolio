import { BlogPost } from '../entities/blog-post.entity';

export const BLOG_REPOSITORY = Symbol('BLOG_REPOSITORY');

export interface BlogListOptions {
  page: number;
  limit: number;
  tag?: string;
  publishedOnly?: boolean;
}

export interface BlogListResult {
  data: BlogPost[];
  total: number;
}

export interface CreateBlogPostData {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  canonicalUrl?: string;
  readingTime: number;
}

export interface UpdateBlogPostData {
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  canonicalUrl?: string;
  readingTime?: number;
  published?: boolean;
  publishedAt?: Date | null;
  kbDocumentId?: string | null;
}

export interface IBlogRepository {
  findAll(options: BlogListOptions): Promise<BlogListResult>;
  findBySlug(slug: string): Promise<BlogPost | null>;
  create(data: CreateBlogPostData): Promise<BlogPost>;
  update(slug: string, data: UpdateBlogPostData): Promise<BlogPost>;
  delete(slug: string): Promise<void>;
  incrementViews(slug: string): Promise<void>;
  slugExists(slug: string): Promise<boolean>;
}
