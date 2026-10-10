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

  @Get('sync-car-status')
  @ApiOperation({ summary: 'Start confirmed rentals for today (Vercel Cron)' })
  async syncCarStatus(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.syncCarAndReservationStatuses();
  }

  @Get('remind-morning')
  @ApiOperation({ summary: 'Morning return reminders (Vercel Cron)' })
  async remindMorning(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.runReminders('MORNING');
  }

  @Get('remind-evening')
  @ApiOperation({ summary: 'Evening return reminders (Vercel Cron)' })
  async remindEvening(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.runReminders('EVENING');
  }

  @Get('notify-ending-today')
  @ApiOperation({ summary: 'Notify staff of rentals ending today (Vercel Cron)' })
  async notifyEndingToday(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.notifyEndingToday();
  }

  @Get('check-overdue')
  @ApiOperation({ summary: 'Overdue return alert to staff (Vercel Cron)' })
  async checkOverdue(@Headers('authorization') authHeader?: string) {
    this.assertCronSecret(authHeader);
    return this.cronService.checkOverdueReturns();
  }
}