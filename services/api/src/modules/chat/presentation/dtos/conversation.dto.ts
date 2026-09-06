import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Voice transcript ingest ───────────────────────────────────────────────────

export class VoiceTurnDto {
  @ApiProperty({ enum: ['user', 'agent'] })
  @IsIn(['user', 'agent'])
  role!: 'user' | 'agent';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  timeInCallSecs?: number;
}

export class SaveVoiceTranscriptDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ type: [VoiceTurnDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoiceTurnDto)
  turns!: VoiceTurnDto[];

  @ApiProperty({ description: 'HMAC-SHA256 of conversationId — issued by POST /chat/transcript-token' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

// ── Admin response shapes ─────────────────────────────────────────────────────

export class ConversationMessageDto {
  @ApiProperty() id!: string;
  @ApiProperty() role!: string;
  @ApiProperty() content!: string;
  @ApiProperty() sources!: unknown[];
  @ApiProperty() toolCalls!: unknown[];
  @ApiProperty() fromCache!: boolean;
  @ApiProperty() createdAt!: string;
}

export class ConversationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() sessionId!: string;
  @ApiProperty() ipHash!: string;
  @ApiProperty() type!: string;
  @ApiProperty() messageCount!: number;
  @ApiProperty() firstMessage!: string;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ConversationDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() sessionId!: string;
  @ApiProperty() ipHash!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ nullable: true }) voiceConversationId!: string | null;
  @ApiProperty({ nullable: true }) summary!: string | null;
  @ApiProperty({ type: [ConversationMessageDto] }) messages!: ConversationMessageDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ConversationsListDto {
  @ApiProperty({ type: [ConversationSummaryDto] }) data!: ConversationSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
