import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export type SkillCategory = string;

export class SkillResponseDto {
  @ApiProperty({ example: "clx..." })
  id!: string;

  @ApiProperty({ example: "NestJS" })
  name!: string;

  @ApiProperty({ example: "backend" })
  category!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  proficiencyLevel!: number;

  @ApiProperty({ example: false })
  featured!: boolean;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class CreateSkillDto {
  @ApiProperty({ example: "NestJS" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "backend", description: "Free-form category string" })
  @IsString()
  category!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  proficiencyLevel!: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiProperty({ example: 0 })
  @IsInt()
  sortOrder!: number;
}
