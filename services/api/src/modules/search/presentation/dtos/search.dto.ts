import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const RESULT_TYPES = ["project", "skill", "experience", "post"] as const;
export type SearchResultType = (typeof RESULT_TYPES)[number];

export class SearchQueryDto {
  @ApiProperty({ description: "Search query string" })
  @IsString()
  q!: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  limit?: number;
}

export class SearchResultItemDto {
  @ApiProperty({ enum: RESULT_TYPES }) type!: SearchResultType;
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() subtitle!: string;
  @ApiProperty() href!: string;
  @ApiPropertyOptional() meta?: string;
}

export class SearchResultsDto {
  @ApiProperty({ type: [SearchResultItemDto] }) projects!: SearchResultItemDto[];
  @ApiProperty({ type: [SearchResultItemDto] }) skills!: SearchResultItemDto[];
  @ApiProperty({ type: [SearchResultItemDto] }) experiences!: SearchResultItemDto[];
  @ApiProperty({ type: [SearchResultItemDto] }) posts!: SearchResultItemDto[];
  @ApiProperty() total!: number;
}
