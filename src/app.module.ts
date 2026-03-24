import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorksModule } from './works/works.module';
import { FilesModule } from './files/files.module';
import { SearchModule } from './search/search.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CommentsModule } from './comments/comments.module';
import { TopicRequestsModule } from './topic-requests/topic-requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorksModule,
    FilesModule,
    SearchModule,
    ReviewsModule,
    CommentsModule,
    TopicRequestsModule,
    NotificationsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
