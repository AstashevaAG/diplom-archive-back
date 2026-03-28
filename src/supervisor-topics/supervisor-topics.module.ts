import { Module } from '@nestjs/common';
import { SupervisorTopicsController } from './supervisor-topics.controller';
import { SupervisorTopicsService } from './supervisor-topics.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SupervisorTopicsController],
  providers: [SupervisorTopicsService],
  exports: [SupervisorTopicsService],
})
export class SupervisorTopicsModule {}
