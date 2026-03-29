import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User, TopicRequest } from '@prisma/client';
import { TopicRequestsService } from './topic-requests.service';
import { CreateTopicRequestDto, RejectTopicRequestDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Topic Requests')
@Controller('topic-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TopicRequestsController {
  constructor(private readonly topicRequestsService: TopicRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Подать заявку на тему' })
  async create(
    @Body() dto: CreateTopicRequestDto,
    @CurrentUser() user: User,
  ): Promise<TopicRequest> {
    return this.topicRequestsService.create(dto, user.id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Мои заявки (студент)' })
  async findMy(@CurrentUser() user: User): Promise<TopicRequest[]> {
    return this.topicRequestsService.findByStudent(user.id);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Входящие заявки (руководитель)' })
  async findInbox(@CurrentUser() user: User): Promise<TopicRequest[]> {
    return this.topicRequestsService.findBySupervisor(user.id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Утвердить заявку и создать работу' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<TopicRequest> {
    return this.topicRequestsService.approve(id, user);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Отклонить заявку с указанием причины' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectTopicRequestDto,
    @CurrentUser() user: User,
  ): Promise<TopicRequest> {
    return this.topicRequestsService.reject(id, user, dto.rejectReason);
  }
}
