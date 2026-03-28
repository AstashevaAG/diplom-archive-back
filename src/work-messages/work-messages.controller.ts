import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { WorkMessagesService, WorkMessageWithAuthor } from './work-messages.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;
}

@ApiTags('Work Messages')
@Controller('works/:workId/messages')
export class WorkMessagesController {
  constructor(private readonly workMessagesService: WorkMessagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отправить сообщение по работе' })
  async send(
    @Param('workId') workId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ): Promise<WorkMessageWithAuthor> {
    return this.workMessagesService.sendMessage(workId, user.id, dto.text);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'История сообщений по работе' })
  async getAll(
    @Param('workId') workId: string,
    @CurrentUser() user: User,
  ): Promise<WorkMessageWithAuthor[]> {
    return this.workMessagesService.getMessages(workId, user.id);
  }
}
