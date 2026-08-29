import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { Car, CarStatus } from '../cars/entities/car.entity';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Car)
    private readonly carRepo: Repository<Car>,
  ) {}

  /**
   * Keeps reservation/car statuses in sync with today's date:
   * - CONFIRMED reservations whose date range includes today -> ONGOING,
   *   and their car -> RENTED.
   * - ONGOING reservations whose endDate has passed -> COMPLETED,
   *   and their car -> AVAILABLE.
   *
   * Cars currently in MAINTENANCE are never overwritten by this job.
   */
  async syncCarAndReservationStatuses() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let startedCount = 0;
    let completedCount = 0;

    // 1. Reservations that should START today: confirmed, and today falls
    //    within [startDate, endDate].
    const toStart = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.CONFIRMED,
        startDate: LessThanOrEqual(endOfToday),
        endDate: MoreThanOrEqual(startOfToday),
      },
      relations: ['car'],
    });

   // 1. Reservations that should START today
for (const reservation of toStart) {
  reservation.status = ReservationStatus.ONGOING;
  if (!reservation.actualPickupDate) {
    reservation.actualPickupDate = now;
  }
  await this.reservationRepo.save(reservation);

  if (reservation.car && reservation.car.status !== CarStatus.MAINTENANCE) {
    await this.carRepo.update(reservation.carId, { status: CarStatus.RESERVED });
  }
  startedCount++;
}
    // 2. Reservations that should COMPLETE: ongoing, and endDate has passed.
    const toComplete = await this.reservationRepo.find({
      where: {
        status: ReservationStatus.ONGOING,
        endDate: LessThan(startOfToday),
      },
      relations: ['car'],
    });

    for (const reservation of toComplete) {
      reservation.status = ReservationStatus.COMPLETED;
      reservation.completedAt = now;
      if (!reservation.actualReturnDate) {
        reservation.actualReturnDate = now;
      }
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
}