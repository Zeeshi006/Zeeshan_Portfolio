import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  IBlogRepository,
  BlogListOptions,
  BlogListResult,
  CreateBlogPostData,
  UpdateBlogPostData,
} from '../../domain/ports/blog-repository.port';
import { BlogPost } from '../../domain/entities/blog-post.entity';

function toEntity(r: {
  id: string; slug: string; title: string; excerpt: string; content: string;
  tags: string[]; published: boolean; publishedAt: Date | null; canonicalUrl: string | null;
  readingTime: number; views: number; kbDocumentId: string | null;
  createdAt: Date; updatedAt: Date;
}): BlogPost {
  return new BlogPost(
    r.id, r.slug, r.title, r.excerpt, r.content, r.tags,
    r.published, r.publishedAt, r.canonicalUrl, r.readingTime,
    r.views, r.kbDocumentId, r.createdAt, r.updatedAt,
  );
}

@Injectable()
export class PrismaBlogRepository implements IBlogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ page, limit, tag, publishedOnly = true }: BlogListOptions): Promise<BlogListResult> {
    const where = {
      ...(publishedOnly && { published: true }),
      ...(tag && { tags: { has: tag } }),
    };
    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { data: data.map(toEntity), total };
  }

  async findBySlug(slug: string): Promise<BlogPost | null> {
    const r = await this.prisma.blogPost.findUnique({ where: { slug } });
    return r ? toEntity(r) : null;
  }

  async create(data: CreateBlogPostData): Promise<BlogPost> {
    const r = await this.prisma.blogPost.create({ data });
    return toEntity(r);
  }

  async update(slug: string, data: UpdateBlogPostData): Promise<BlogPost> {
    const r = await this.prisma.blogPost.update({ where: { slug }, data });
    return toEntity(r);
  }

  async delete(slug: string): Promise<void> {
    await this.prisma.blogPost.delete({ where: { slug } });
  }

  async incrementViews(slug: string): Promise<void> {
    await this.prisma.blogPost.update({
      where: { slug },
      data: { views: { increment: 1 } },
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.blogPost.count({ where: { slug } });
    return count > 0;
  }
}
