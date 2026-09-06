import { Module } from "@nestjs/common";
import { SearchController } from "./presentation/controllers/search.controller";
import { SearchUseCase } from "./application/use-cases/search.use-case";

@Module({
  controllers: [SearchController],
  providers: [SearchUseCase],
})
export class SearchModule {}
