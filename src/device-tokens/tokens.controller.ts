import { Body, Controller, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeviceTokensService } from './device-tokens.service';

@ApiTags('device-tokens')
@Controller('device-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeviceTokensController {
  constructor(private readonly deviceTokensService: DeviceTokensService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or refresh this device\'s FCM token for push notifications' })
  async register(
    @Req() req,
    @Body('token') token: string,
    @Body('platform') platform: 'android' | 'ios' = 'android',
  ) {
    await this.deviceTokensService.register(req.user.id, token, platform);
    return { success: true };
  }
}