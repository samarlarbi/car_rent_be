import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { Car, CarStatus } from '../cars/entities/car.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { OverdueNotification } from '../notifications/entities/overdue-notification.entity';
import { ReservationsService } from '../reservations/reservations.service';

@Injectable()
export class CronService {
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

  async syncCarAndReservationStatuses() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let startedCount = 0;

    const toStart = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        startDate: LessThanOrEqual(endOfToday),
        endDate: MoreThanOrEqual(startOfToday),
      },
    });

    for (const reservation of toStart) {
      try {
        reservation.status = ReservationStatus.ONGOING;
        await this.reservationRepo.save(reservation);
        startedCount++;
      } catch (e) {
        this.logger.error(`Failed to start reservation ${reservation.id}`, e as Error);
      }
    }

    const cars = await this.carRepo.find({
      where: { deletedAt: IsNull() },
      select: { id: true },
    });
    for (const car of cars) {
      await this.reservationsService.syncCarStatus(car.id);
    }

    this.logger.log(`Cron sync: started ${startedCount} rental(s), synced ${cars.length} car(s)`);
    return { started: startedCount, cars: cars.length, ranAt: now.toISOString() };
  }

  async runReminders(slot: 'MORNING' | 'EVENING') {
    this.logger.log(`Running ${slot} return reminders...`);
    await this.reservationsService.handleReturnReminders(slot);
    return { ok: true, slot, ranAt: new Date().toISOString() };
  }

  async checkOverdueReturns() {
    const now = new Date();
    const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const overdue = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.ONGOING,
        endDate: Between(since, now),
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
        ? `${reservation.car.marque || 'Voiture'} (${reservation.car.matricule || 'N/A'})`
        : 'Véhicule';

      const body = `La location du véhicule ${carLabel} est en retard de restitution.`;

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