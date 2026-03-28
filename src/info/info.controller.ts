import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { InfoService, InfoPostWithAuthor } from './info.service';
import { CreateInfoPostDto, UpdateInfoPostDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Info')
@Controller('info')
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать информационную запись (преподаватель/admin)' })
  async create(
    @Body() dto: CreateInfoPostDto,
    @CurrentUser() user: User,
  ): Promise<InfoPostWithAuthor> {
    return this.infoService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список информационных записей' })
  @ApiQuery({ name: 'q', required: false })
  async findAll(@Query('q') q?: string): Promise<InfoPostWithAuthor[]> {
    return this.infoService.findAll(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Информационная запись по ID' })
  async findOne(@Param('id') id: string): Promise<InfoPostWithAuthor> {
    return this.infoService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить запись' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInfoPostDto,
    @CurrentUser() user: User,
  ): Promise<InfoPostWithAuthor> {
    return this.infoService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить запись' })
  async delete(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    return this.infoService.delete(id, user.id, user.role);
  }
}
