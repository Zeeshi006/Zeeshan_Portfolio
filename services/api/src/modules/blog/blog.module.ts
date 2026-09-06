import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BLOG_REPOSITORY } from './domain/ports/blog-repository.port';
import { PrismaBlogRepository } from './infrastructure/repositories/prisma-blog.repository';
import { SlugService } from './application/services/slug.service';
import { ReadingTimeService } from './application/services/reading-time.service';
import { GetPostsUseCase } from './application/use-cases/get-posts.use-case';
import { GetPostBySlugUseCase } from './application/use-cases/get-post-by-slug.use-case';
import { CreatePostUseCase } from './application/use-cases/create-post.use-case';
import { UpdatePostUseCase } from './application/use-cases/update-post.use-case';
import { DeletePostUseCase } from './application/use-cases/delete-post.use-case';
import { BlogController } from './presentation/controllers/blog.controller';
import { ChatModule } from '../chat/chat.module';
import { KB_EMBED_QUEUE, KB_SYNC_QUEUE } from '../queue/constants';

@Module({
  imports: [
    ChatModule,
    BullModule.registerQueue({ name: KB_EMBED_QUEUE }),
    BullModule.registerQueue({ name: KB_SYNC_QUEUE }),
  ],
  controllers: [BlogController],
  providers: [
    PrismaService,
    { provide: BLOG_REPOSITORY, useClass: PrismaBlogRepository },
    SlugService,
    ReadingTimeService,
    GetPostsUseCase,
    GetPostBySlugUseCase,
    CreatePostUseCase,
    UpdatePostUseCase,
    DeletePostUseCase,
  ],
})
export class BlogModule {}
