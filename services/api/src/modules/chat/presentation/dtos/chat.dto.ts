import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConversationTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsString()
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'What projects has Hammad worked on?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class AskDto {
  @ApiProperty({ description: 'Question to ask the chatbot', minLength: 2, maxLength: 500, example: 'What projects has Hammad worked on?' })
  @IsString()
  @MinLength(2, { message: 'Query must be at least 2 characters' })
  @MaxLength(500, { message: 'Query must not exceed 500 characters' })
  query!: string;

  @ApiPropertyOptional({
    description: 'Optional prior conversation turns for multi-turn context (max 15 turns)',
    type: [ConversationTurnDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationTurnDto)
  @ArrayMaxSize(15, { message: 'History must not exceed 15 turns' })
  history?: ConversationTurnDto[];

  @ApiPropertyOptional({ description: 'Analytics session ID — used to fetch visitor browsing context for personalised responses' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class SourceDto {
  @ApiProperty({ example: 'clx...' })
  id!: string;

  @ApiProperty({ example: 'Sales CRM case study' })
  title!: string;
}

export class NavToolCallDto {
  @ApiProperty({ example: 'navigateToSection' })
  name!: string;

  @ApiProperty({ type: Object, example: { sectionId: 'projects' } })
  args!: Record<string, unknown>;
}

export class ChatResponseDto {
  @ApiProperty({ example: 'Hammad has worked on a real-time sales CRM...' })
  answer!: string;

  @ApiProperty({ type: [SourceDto] })
  sources!: SourceDto[];

  @ApiProperty({ type: [NavToolCallDto] })
  toolCalls!: NavToolCallDto[];
}

export class FeedbackDto {
  @ApiPropertyOptional({ description: 'Chat session cookie ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Message content being rated' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  messageContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  thumbsUp?: boolean;
}

export class CreateKBDocumentDto {
  @ApiProperty({ example: 'Sales CRM case study' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'This case study covers the design and implementation of...' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  published?: boolean;

  @ApiPropertyOptional({ example: { tags: ['backend', 'crm'] } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateKBDocumentDto extends PartialType(CreateKBDocumentDto) {}

export class KBDocumentResponseDto {
  @ApiProperty({ example: 'clx...' })
  id!: string;

  @ApiProperty({ example: 'Sales CRM case study' })
  title!: string;

  @ApiProperty({ example: 'This case study covers...' })
  content!: string;

  @ApiPropertyOptional({ example: { tags: ['backend'] } })
  metadata!: Record<string, unknown>;

  @ApiProperty({ example: true })
  published!: boolean;
}

export class KBAnalyticsItemDto {
  @ApiProperty()
  docId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  citationCount!: number;
}
