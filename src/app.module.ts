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
import { CronModule } from './cron/cron.module';
import { OverdueNotification } from './notifications/entities/overdue-notification.entity';
import { DeviceToken } from './device-tokens/entities/device-token.entity';
import { DeviceTokensModule } from './device-tokens/device-tokens.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    CronModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const connectionString = configService.get('DB_CONNECTION_STRING');
        if (connectionString) {
          // Hosted Postgres providers (Neon, Supabase, Railway…) require SSL
          // in production; local databases must NOT use it.
          const needsSsl =
            isProduction ||
            /sslmode=require/.test(connectionString) ||
            configService.get('DB_SSL') === 'true';
          return {
            type: 'postgres',
            url: connectionString,
            entities: [User, Car, Reservation, Customer, OverdueNotification, DeviceToken],
            synchronize: !isProduction,
            logging: !isProduction,
            ssl: needsSsl ? { rejectUnauthorized: false } : false,
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
          entities: [User, Car, Reservation, Customer, OverdueNotification, DeviceToken],
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
    DeviceTokensModule,
    NotificationsModule,
  ],
})
export class AppModule {}
