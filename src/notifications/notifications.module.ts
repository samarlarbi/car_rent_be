import { Module } from '@nestjs/common';
import { DeviceTokensModule } from '../device-tokens/device-tokens.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [DeviceTokensModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}