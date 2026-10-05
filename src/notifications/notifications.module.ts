import { Module } from '@nestjs/common';
import { DeviceTokensModule } from '../device-tokens/device-tokens.module';
import { NotificationsService } from './notifications.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from '@/device-tokens/entities/device-token.entity';

@Module({
  imports: [DeviceTokensModule,
    TypeOrmModule.forFeature([DeviceToken]), // <-- C'est ceci qui manquait pour lier le Repository
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}