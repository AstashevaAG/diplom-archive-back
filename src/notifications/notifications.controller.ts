import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User, Notification } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Мои уведомления' })
  async findMy(@CurrentUser() user: User): Promise<Notification[]> {
    return this.notificationsService.findByUser(user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Количество непрочитанных' })
  async getUnreadCount(
    @CurrentUser() user: User,
  ): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Пометить прочитанным' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Notification> {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Прочитать все' })
  async markAllAsRead(
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.notificationsService.markAllAsRead(user.id);
    return { message: 'Все уведомления прочитаны' };
  }
}
