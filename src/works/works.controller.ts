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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { WorksService } from './works.service';
import {
  CreateWorkDto,
  UpdateWorkDto,
  UpdateWorkStatusDto,
  UpdateStageDto,
  WorkQueryDto,
} from './dto';
import { PaginatedResult, WorkWithRelations } from './interfaces';
import { WorkStage } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Works')
@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать дипломную работу' })
  async create(
    @Body() dto: CreateWorkDto,
    @CurrentUser() user: User,
  ): Promise<WorkWithRelations> {
    return this.worksService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Каталог работ с фильтрами' })
  async findAll(
    @Query() query: WorkQueryDto,
  ): Promise<PaginatedResult<WorkWithRelations>> {
    return this.worksService.findAll(query);
  }

  @Get('public')
  @ApiOperation({ summary: 'Публичный каталог для гостей' })
  async findPublic(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResult<WorkWithRelations>> {
    return this.worksService.findPublic(page, limit);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Мои работы (студент)' })
  async findMy(@CurrentUser() user: User): Promise<WorkWithRelations[]> {
    return this.worksService.findByAuthor(user.id);
  }

  @Get('supervised')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Работы под руководством (преподаватель)' })
  async findSupervised(
    @CurrentUser() user: User,
  ): Promise<WorkWithRelations[]> {
    return this.worksService.findBySupervisor(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Карточка работы' })
  async findOne(@Param('id') id: string): Promise<WorkWithRelations> {
    return this.worksService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить работу' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkDto,
    @CurrentUser() user: User,
  ): Promise<WorkWithRelations> {
    return this.worksService.update(id, dto, user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Изменить статус работы' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWorkStatusDto,
    @CurrentUser() user: User,
  ): Promise<WorkWithRelations> {
    return this.worksService.updateStatus(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить работу' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.worksService.delete(id, user);
  }

  @Get(':id/stages')
  @ApiOperation({ summary: 'Этапы работы' })
  async getStages(@Param('id') id: string): Promise<WorkStage[]> {
    return this.worksService.getStages(id);
  }

  @Patch(':id/stages/:stageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить статус этапа' })
  async updateStage(
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
    @CurrentUser() user: User,
  ): Promise<WorkStage> {
    return this.worksService.updateStage(id, stageId, dto, user);
  }
}
