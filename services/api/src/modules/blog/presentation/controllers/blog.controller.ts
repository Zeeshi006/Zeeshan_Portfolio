import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { GetPostsUseCase } from '../../application/use-cases/get-posts.use-case';
import { GetPostBySlugUseCase } from '../../application/use-cases/get-post-by-slug.use-case';
import { CreatePostUseCase } from '../../application/use-cases/create-post.use-case';
import { UpdatePostUseCase } from '../../application/use-cases/update-post.use-case';
import { DeletePostUseCase } from '../../application/use-cases/delete-post.use-case';
import { BlogPost } from '../../domain/entities/blog-post.entity';
import {
  BlogListResponseDto, BlogPostDetailDto, BlogPostSummaryDto,
  CreateBlogPostDto, UpdateBlogPostDto,
} from '../dtos/blog.dto';

function toSummary(p: BlogPost): BlogPostSummaryDto {
  return {
    id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt,
    tags: p.tags, published: p.published,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    readingTime: p.readingTime, views: p.views,
    createdAt: p.createdAt.toISOString(),
  };
}

function toDetail(p: BlogPost): BlogPostDetailDto {
  return {
    ...toSummary(p),
    content: p.content,
    canonicalUrl: p.canonicalUrl,
    kbDocumentId: p.kbDocumentId,
  };
}

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(
    private readonly getPosts: GetPostsUseCase,
    private readonly getPostBySlug: GetPostBySlugUseCase,
    private readonly createPost: CreatePostUseCase,
    private readonly updatePost: UpdatePostUseCase,
    private readonly deletePost: DeletePostUseCase,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOkResponse({ type: BlogListResponseDto })
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('tag') tag?: string,
  ): Promise<BlogListResponseDto> {
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const result = await this.getPosts.execute(p, l, tag, false);
    return { data: result.data.map(toSummary), total: result.total, page: p, limit: l };
  }

  @Get(':slug')
  @ApiOkResponse({ type: BlogPostDetailDto })
  async getOne(@Param('slug') slug: string): Promise<BlogPostDetailDto> {
    return toDetail(await this.getPostBySlug.execute(slug, false));
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: BlogListResponseDto })
  async adminList(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<BlogListResponseDto> {
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const result = await this.getPosts.execute(p, l, undefined, true);
    return { data: result.data.map(toSummary), total: result.total, page: p, limit: l };
  }

  @Get('admin/:slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async adminGetOne(@Param('slug') slug: string): Promise<BlogPostDetailDto> {
    return toDetail(await this.getPostBySlug.execute(slug, true));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreateBlogPostDto): Promise<BlogPostDetailDto> {
    return toDetail(await this.createPost.execute(dto));
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateBlogPostDto,
  ): Promise<BlogPostDetailDto> {
    return toDetail(await this.updatePost.execute(slug, dto));
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async remove(@Param('slug') slug: string): Promise<void> {
    await this.deletePost.execute(slug);
  }
}
