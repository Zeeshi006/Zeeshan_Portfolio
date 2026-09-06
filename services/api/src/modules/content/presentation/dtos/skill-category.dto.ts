import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Min } from "class-validator";

export class SkillCategoryResponseDto {
  @ApiProperty({ example: "clx..." })
  id!: string;

  @ApiProperty({ example: "backend" })
  name!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class CreateSkillCategoryDto {
  @ApiProperty({ example: "languages" })
  @IsString()
  name!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
