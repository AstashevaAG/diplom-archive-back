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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { User, SupervisorTopic, TopicResponse } from '@prisma/client';
import { SupervisorTopicsService } from './supervisor-topics.service';
import {
  CreateSupervisorTopicDto,
  UpdateSupervisorTopicDto,
  RespondToTopicDto,
  SendTopicResponseMessageDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import type { TopicResponseMessageWithAuthor } from './supervisor-topics.service';

@ApiTags('Supervisor Topics')
@Controller('supervisor-topics')
export class SupervisorTopicsController {
  constructor(private readonly supervisorTopicsService: SupervisorTopicsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать предложение темы (преподаватель)' })
  async create(
    @Body() dto: CreateSupervisorTopicDto,
    @CurrentUser() user: User,
  ): Promise<SupervisorTopic> {
    return this.supervisorTopicsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список тем от преподавателей' })
  @ApiQuery({ name: 'supervisorId', required: false })
  @ApiQuery({ name: 'area', required: false })
  async findAll(
    @Query('supervisorId') supervisorId?: string,
    @Query('area') area?: string,
  ): Promise<SupervisorTopic[]> {
    return this.supervisorTopicsService.findAll(supervisorId, area);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Мои темы с откликами (преподаватель)' })
  async findMy(@CurrentUser() user: User): Promise<SupervisorTopic[]> {
    return this.supervisorTopicsService.findMy(user.id);
  }

  @Get('my-responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Мои отклики на темы (студент)' })
  async getMyResponses(@CurrentUser() user: User): Promise<TopicResponse[]> {
    return this.supervisorTopicsService.getMyResponses(user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить тему' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupervisorTopicDto,
    @CurrentUser() user: User,
  ): Promise<SupervisorTopic> {
    return this.supervisorTopicsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить тему' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.supervisorTopicsService.delete(id, user.id);
  }

  @Post(':id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Откликнуться на тему (студент)' })
  async respond(
    @Param('id') topicId: string,
    @Body() dto: RespondToTopicDto,
    @CurrentUser() user: User,
  ): Promise<TopicResponse> {
    return this.supervisorTopicsService.respond(topicId, user.id, dto);
  }

  @Get(':id/responses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отклики на тему (преподаватель)' })
  async getResponses(
    @Param('id') topicId: string,
    @CurrentUser() user: User,
  ): Promise<TopicResponse[]> {
    return this.supervisorTopicsService.getResponses(topicId, user.id);
  }

  @Get(':id/responses/:responseId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Диалог по отклику на тему' })
  async getResponseMessages(
    @Param('id') topicId: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: User,
  ): Promise<TopicResponseMessageWithAuthor[]> {
    return this.supervisorTopicsService.getResponseMessages(
      topicId,
      responseId,
      user.id,
    );
  }

  @Post(':id/responses/:responseId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отправить сообщение по отклику на тему' })
  async sendResponseMessage(
    @Param('id') topicId: string,
    @Param('responseId') responseId: string,
    @Body() dto: SendTopicResponseMessageDto,
    @CurrentUser() user: User,
  ): Promise<TopicResponseMessageWithAuthor> {
    return this.supervisorTopicsService.sendResponseMessage(
      topicId,
      responseId,
      user.id,
      dto.text,
    );
  }

  @Patch(':id/responses/:responseId/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Принять отклик студента' })
  async acceptResponse(
    @Param('id') topicId: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: User,
  ): Promise<TopicResponse> {
    return this.supervisorTopicsService.acceptResponse(topicId, responseId, user.id);
  }

  @Patch(':id/responses/:responseId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отклонить отклик студента' })
  async rejectResponse(
    @Param('id') topicId: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: User,
  ): Promise<TopicResponse> {
    return this.supervisorTopicsService.rejectResponse(topicId, responseId, user.id);
  }
}
