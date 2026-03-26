import { Module } from '@nestjs/common';
import { TopicRequestsController } from './topic-requests.controller';
import { TopicRequestsService } from './topic-requests.service';

@Module({
  controllers: [TopicRequestsController],
  providers: [TopicRequestsService],
})
export class TopicRequestsModule {}
