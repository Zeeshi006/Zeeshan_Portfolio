import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/infrastructure/guards/jwt-auth.guard";
import { PrismaSiteContentRepository } from "../../infrastructure/repositories/prisma-site-content.repository";

class UpsertSiteContentDto {
  @ApiProperty({ type: Object })
  @IsObject()
  value!: Record<string, unknown>;
}

@ApiTags("content")
@Controller("content/site")
export class SiteContentController {
  constructor(private readonly repo: PrismaSiteContentRepository) {}

  @Get(":key")
  @ApiOkResponse()
  async findByKey(@Param("key") key: string): Promise<Record<string, unknown> | null> {
    const item = await this.repo.findByKey(key);
    return item?.value ?? null;
  }

  @Put(":key")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async upsert(
    @Param("key") key: string,
    @Body() dto: UpsertSiteContentDto,
  ): Promise<Record<string, unknown>> {
    const item = await this.repo.upsert(key, dto.value);
    return item.value;
  }
}
