import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto';
import { FaqItemWithAuthor, FaqService } from './faq.service';

@ApiTags('FAQ')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Список опубликованных вопросов FAQ' })
  async findPublished(): Promise<FaqItemWithAuthor[]> {
    return this.faqService.findPublished();
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Список всех вопросов FAQ для преподавателя/admin' })
  async findAllForAdmin(): Promise<FaqItemWithAuthor[]> {
    return this.faqService.findAllForAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать вопрос FAQ (преподаватель/admin)' })
  async create(
    @Body() dto: CreateFaqItemDto,
    @CurrentUser() user: User,
  ): Promise<FaqItemWithAuthor> {
    return this.faqService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить вопрос FAQ (преподаватель/admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFaqItemDto,
  ): Promise<FaqItemWithAuthor> {
    return this.faqService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить вопрос FAQ (преподаватель/admin)' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.faqService.delete(id);
  }
}
