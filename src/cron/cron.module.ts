import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Car } from '../cars/entities/car.entity';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { OverdueNotification } from '../notifications/entities/overdue-notification.entity';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Car, OverdueNotification,]),
    NotificationsModule,
    ReservationsModule
  ],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}