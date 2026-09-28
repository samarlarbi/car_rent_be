import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CronService } from './cron.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  private assertCronSecret(authHeader?: string) {
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }
  }

  // No @UseGuards(JwtAuthGuard) here: Vercel's cron trigger has no user
  // session. Instead we check a shared secret sent as a Bearer token.
  @Get('sync-car-status')
  @ApiOperation({ summary: 'Sync car/reservation statuses based on today (called by Vercel Cron)' })
  async syncCarStatus(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.syncCarAndReservationStatuses();
  }

  @Get('check-overdue')
  @ApiOperation({ summary: 'Push a "return overdue" alert to staff for any ongoing rental past its end date (called by Vercel Cron)' })
  async checkOverdue(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.checkOverdueReturns();
  }
}