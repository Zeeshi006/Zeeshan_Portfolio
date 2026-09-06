import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString } from "class-validator";

const STATUSES = ["shipped", "in_progress", "archived"] as const;

export class ProjectResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() tagline!: string;
  @ApiProperty({ type: [String] }) techStack!: string[];
  @ApiProperty() outcomeMetric!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiProperty() featured!: boolean;
  @ApiProperty() sortOrder!: number;
  @ApiPropertyOptional() liveUrl!: string | null;
  @ApiPropertyOptional() githubUrl!: string | null;
  @ApiPropertyOptional() videoUrl!: string | null;
  @ApiProperty() caseStudyPublished!: boolean;
  @ApiPropertyOptional() context!: string | null;
  @ApiPropertyOptional() problem!: string | null;
  @ApiPropertyOptional() architectureDiagram!: string | null;
  @ApiPropertyOptional() diagramImageUrl!: string | null;
  @ApiProperty({ type: [Object] }) keyDecisions!: object[];
  @ApiPropertyOptional() hardParts!: string | null;
  @ApiPropertyOptional() outcome!: string | null;
}

export class CreateProjectDto {
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() slug!: string;
  @ApiProperty() @IsString() tagline!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) techStack!: string[];
  @ApiProperty() @IsString() outcomeMetric!: string;
  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES) status!: string;
  @ApiProperty() @IsBoolean() featured!: boolean;
  @ApiProperty() @IsInt() sortOrder!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() liveUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() githubUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() caseStudyPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() context?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() problem?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() architectureDiagram?: string;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() keyDecisions?: object[];
  @ApiPropertyOptional() @IsOptional() @IsString() hardParts?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outcome?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
