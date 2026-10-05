import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { Reservation } from './entities/reservation.entity';
import { Car } from '../cars/entities/car.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CarsModule } from '../cars/cars.module'; 
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '@/notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Car, Customer]),CarsModule,    
    CustomersModule,NotificationsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}