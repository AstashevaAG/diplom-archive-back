import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User, Comment } from '@prisma/client';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('works/:workId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Добавить комментарий' })
  async create(
    @Param('workId') workId: string,
    @Body('text') text: string,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.commentsService.create(workId, user.id, text);
  }

  @Get('works/:workId/comments')
  @ApiOperation({ summary: 'Комментарии к работе' })
  async findByWork(@Param('workId') workId: string): Promise<Comment[]> {
    return this.commentsService.findByWork(workId);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить комментарий' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.commentsService.delete(id, user.id);
  }
}
