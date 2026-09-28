import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { DeviceTokensService } from './device-tokens.service';
import { DeviceTokensController } from './tokens.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  controllers: [DeviceTokensController],
  providers: [DeviceTokensService],
  exports: [DeviceTokensService],
})
export class DeviceTokensModule {}