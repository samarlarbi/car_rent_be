import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CarsModule } from './cars/cars.module';
import { ReservationsModule } from './reservations/reservations.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { User } from './auth/entities/user.entity';
import { Car } from './cars/entities/car.entity';
import { Reservation } from './reservations/entities/reservation.entity';
import { Customer } from './customers/entities/customer.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get('DB_CONNECTION_STRING');
console.log('Connection string is:', connectionString);
        if (connectionString) {
          return {
            type: 'postgres',
url: connectionString,            entities: [User, Car, Reservation, Customer],
            synchronize: configService.get('NODE_ENV') === 'development',
            logging: configService.get('NODE_ENV') === 'development',
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres',
          host: configService.get('DB_HOST', 'localhost'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'postgres'),
          password: configService.get('DB_PASSWORD', ''),
          database: configService.get('DB_DATABASE', 'car_rental_db'),
          ssl: configService.get('DB_SSL', false) === 'true' 
            ? { rejectUnauthorized: false } 
            : false,
          entities: [User, Car, Reservation, Customer],
          synchronize: configService.get('NODE_ENV') === 'development',
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    CarsModule,
    ReservationsModule,
    CustomersModule,
    DashboardModule,
  ],
})
export class AppModule {}