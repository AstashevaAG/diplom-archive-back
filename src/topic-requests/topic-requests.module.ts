import { Module } from '@nestjs/common';
import { TopicRequestsController } from './topic-requests.controller';
import { TopicRequestsService } from './topic-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TopicRequestsController],
  providers: [TopicRequestsService],
})
export class TopicRequestsModule {}
