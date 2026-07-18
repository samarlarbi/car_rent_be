import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarsService } from './cars.service';
import { CarsController } from './cars.controller';
import { Car } from './entities/car.entity';
import { Reservation } from '@/reservations/entities/reservation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Car,Reservation])],
  controllers: [CarsController],
  providers: [CarsService],
  exports: [CarsService],
})
export class CarsModule {}