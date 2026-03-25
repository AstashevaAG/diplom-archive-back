import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SuggestQueryDto } from './dto';
import { SearchResponse, SuggestResult } from './interfaces';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Полнотекстовый поиск по работам' })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponse> {
    return this.searchService.search(query);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Автодополнение по названию' })
  async suggest(@Query() query: SuggestQueryDto): Promise<SuggestResult[]> {
    return this.searchService.suggest(query);
  }
}
