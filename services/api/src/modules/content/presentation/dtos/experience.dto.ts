import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsArray, IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class ExperienceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() company!: string;
  @ApiProperty() role!: string;
  @ApiProperty() startDate!: string;
  @ApiPropertyOptional({ nullable: true }) endDate!: string | null;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: [String] }) highlights!: string[];
  @ApiProperty() sortOrder!: number;
}

export class CreateExperienceDto {
  @ApiProperty() @IsString() company!: string;
  @ApiProperty() @IsString() role!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endDate?: string;
  @ApiProperty() @IsString() summary!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) highlights!: string[];
  @ApiProperty() @IsInt() sortOrder!: number;
}

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}
