import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkMessagesController } from './work-messages.controller';
import { WorkMessagesService } from './work-messages.service';
import { WorkMessagesGateway } from './work-messages.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [WorkMessagesController],
  providers: [WorkMessagesService, WorkMessagesGateway],
  exports: [WorkMessagesService],
})
export class WorkMessagesModule {}
