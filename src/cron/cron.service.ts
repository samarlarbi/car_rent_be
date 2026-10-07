import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { Car, CarStatus } from '../cars/entities/car.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { OverdueNotification } from '../notifications/entities/overdue-notification.entity';
import { ReservationsService } from '../reservations/reservations.service';
import * as cron from 'node-cron';

@Injectable()
export class CronService implements OnModuleInit {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Car)
    private readonly carRepo: Repository<Car>,
    @InjectRepository(OverdueNotification)
    private readonly overdueNotificationRepo: Repository<OverdueNotification>,
    private readonly notificationsService: NotificationsService,
    private readonly reservationsService: ReservationsService,
  ) {}

  onModuleInit() {
    // 8:00 AM daily reminders
    cron.schedule('0 12 * * *', async () => {
      this.logger.log('Running 8:00 AM return reminders...');
      await this.reservationsService.handleReturnReminders('MORNING');
    });

    // Evening reminders
    cron.schedule('55 19 * * *', async () => {
      this.logger.log('Running evening return reminders...');
      await this.reservationsService.handleReturnReminders('EVENING');
    });

    // Hourly sync
    cron.schedule('0 * * * *', async () => {
      await this.syncCarAndReservationStatuses();
    });
  }

  async syncCarAndReservationStatuses() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let startedCount = 0;
    let completedCount = 0;

    const toStart = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        startDate: LessThanOrEqual(endOfToday),
        endDate: MoreThanOrEqual(startOfToday),
      },
      relations: ['car'],
    });

    for (const reservation of toStart) {
      reservation.status = ReservationStatus.ONGOING;
      await this.reservationRepo.save(reservation);

      if (reservation.car && reservation.car.status !== CarStatus.MAINTENANCE) {
        await this.carRepo.update(reservation.carId, { status: CarStatus.RESERVED });
      }
      startedCount++;
    }

    const toComplete = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.ONGOING,
        endDate: LessThan(now),
      },
      relations: ['car'],
    });

    for (const reservation of toComplete) {
      reservation.status = ReservationStatus.COMPLETED;
      await this.reservationRepo.save(reservation);

      if (reservation.car && reservation.car.status !== CarStatus.MAINTENANCE) {
        await this.carRepo.update(reservation.carId, { status: CarStatus.AVAILABLE });
      }
      completedCount++;
    }

    this.logger.log(
      `Cron sync: started ${startedCount} rental(s), completed ${completedCount} rental(s)`,
    );

    return {
      started: startedCount,
      completed: completedCount,
      ranAt: now.toISOString(),
    };
  }

  async checkOverdueReturns() {
    const now = new Date();

    const overdue = await this.reservationRepo.find({
      where: {
        status: In([ReservationStatus.ONGOING, ReservationStatus.COMPLETED]),
        endDate: LessThan(now),
      },
      relations: ['car', 'customer'],
    });

    let notifiedCount = 0;

    for (const reservation of overdue) {
      const alreadyNotified = await this.overdueNotificationRepo.findOne({
        where: { reservationId: reservation.id },
      });
      if (alreadyNotified) continue;

      const carLabel = reservation.car
        ? `${reservation.car.make} ${reservation.car.model}`
        : 'Véhicule';

      const body = `La location de la ${carLabel} est en retard de restitution.`;

      try {
        await this.notificationsService.sendToAllActiveStaff('Retard de retour ⚠️', body, {
          reservationId: reservation.id,
          type: 'overdue_return',
        });
        await this.overdueNotificationRepo.save(
          this.overdueNotificationRepo.create({ reservationId: reservation.id }),
        );
        notifiedCount++;
      } catch (e) {
        this.logger.error(`Failed to send overdue push for reservation ${reservation.id}`, e as Error);
      }
    }

    this.logger.log(`Overdue check: notified ${notifiedCount} reservation(s)`);

    return { notified: notifiedCount, ranAt: now.toISOString() };
  }
}