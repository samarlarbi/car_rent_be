import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Car } from '../cars/entities/car.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Customer } from '../customers/entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Car, Reservation, Customer])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}