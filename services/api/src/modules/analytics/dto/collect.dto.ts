import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const EVENT_TYPES = [
  "page_view", "cta_click", "chatbot_open", "chatbot_query", "call_open",
  "case_study_read", "case_study_click", "section_view", "project_click",
  "nav_click", "session_end", "contact_form",
] as const;

export class CollectEventDto {
  @ApiProperty({ description: "Event type", enum: EVENT_TYPES, example: "page_view" })
  @IsEnum(EVENT_TYPES)
  type!: string;

  @ApiProperty({ description: "URL path of the page", example: "/projects" })
  @IsString()
  @MaxLength(2048)
  path!: string;

  @ApiPropertyOptional({ description: "Section identifier within the page", example: "experience" })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  section?: string;

  @ApiProperty({ description: "Anonymous session identifier (generated client-side)", example: "sess_abc123" })
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @ApiPropertyOptional({
    description: "Arbitrary event metadata",
    example: { scrollDepth: 80 },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
