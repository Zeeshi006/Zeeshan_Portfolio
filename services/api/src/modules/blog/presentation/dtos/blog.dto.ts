import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength,
} from 'class-validator';

export class CreateBlogPostDto {
  @ApiProperty({ example: 'How I Built a RAG Chatbot on pgvector' })
  @IsString() @MinLength(3) @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'A deep dive into embedding pipelines and retrieval.' })
  @IsString() @MinLength(10) @MaxLength(500)
  excerpt!: string;

  @ApiProperty({ example: '## Introduction\n\nThis post covers...' })
  @IsString() @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ example: ['system-design', 'ai'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'my-custom-slug' })
  @IsOptional() @IsString() @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/pulse/...' })
  @IsOptional() @IsUrl()
  canonicalUrl?: string;
}

export class UpdateBlogPostDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(200)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(10) @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1)
  content?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsUrl()
  canonicalUrl?: string;
}

export class BlogPostSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty() excerpt!: string;
  @ApiProperty() tags!: string[];
  @ApiProperty() published!: boolean;
  @ApiProperty() publishedAt!: string | null;
  @ApiProperty() readingTime!: number;
  @ApiProperty() views!: number;
  @ApiProperty() createdAt!: string;
}

export class BlogPostDetailDto extends BlogPostSummaryDto {
  @ApiProperty() content!: string;
  @ApiPropertyOptional() canonicalUrl!: string | null;
  @ApiPropertyOptional() kbDocumentId!: string | null;
}

export class BlogListResponseDto {
  @ApiProperty({ type: [BlogPostSummaryDto] }) data!: BlogPostSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
