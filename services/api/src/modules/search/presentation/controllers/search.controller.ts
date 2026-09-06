import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SearchUseCase } from "../../application/use-cases/search.use-case";
import { SearchQueryDto, SearchResultsDto } from "../dtos/search.dto";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchUseCase: SearchUseCase) {}

  @Get()
  @ApiOkResponse({ type: SearchResultsDto })
  search(@Query() query: SearchQueryDto): Promise<SearchResultsDto> {
    return this.searchUseCase.execute(query.q, query.limit ?? 5);
  }
}
