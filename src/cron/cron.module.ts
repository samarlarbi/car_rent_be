import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Car } from '../cars/entities/car.entity';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Car])],
  controllers: [CronController],
  providers: [CronService],
})
export class CronModule {}
