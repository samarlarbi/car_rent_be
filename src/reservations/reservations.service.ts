import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, Between, LessThan, MoreThan, In, MoreThanOrEqual, LessThanOrEqual, Not } from 'typeorm';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { Car, CarStatus } from '../cars/entities/car.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ReminderLog } from '../cron/reminder-log.entity';
@Injectable()
export class ReservationsService {
  private readonly logger = new (require('@nestjs/common').Logger)(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    @InjectRepository(Car)
    private carsRepository: Repository<Car>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(ReminderLog)
    private readonly reminderLogRepo: Repository<ReminderLog>, // <--- Add this
  ) {}

 async create(createReservationDto: CreateReservationDto, userId: string): Promise<Reservation> {
    const startDate = new Date(createReservationDto.startDate);
    const endDate = new Date(createReservationDto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const car = await this.carsRepository.findOne({
      where: { id: createReservationDto.carId, deletedAt: IsNull() },
    });

    if (!car) {
      throw new NotFoundException('Car not found');
    }

    if (createReservationDto.customerId) {
      const customer = await this.customersRepository.findOne({
        where: { id: createReservationDto.customerId, deletedAt: IsNull() },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
    }

    const overlapping = await this.reservationsRepository.findOne({
      where: {
        carId: createReservationDto.carId,
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
        deletedAt: IsNull(),
        startDate: LessThan(endDate),
        endDate: MoreThan(startDate),
      },
    });

    if (overlapping) {
      throw new ConflictException('Car is not available for the selected dates');
    }

    const reservation = this.reservationsRepository.create({
      carId: createReservationDto.carId,
      customerId: createReservationDto.customerId ?? null,
      startDate,
      endDate,
      notes: createReservationDto.notes,
      status: ReservationStatus.CONFIRMED,
    });

    const saved = await this.reservationsRepository.save(reservation);

    // Automatically sync the car status based on whether this reservation covers 'now'
    await this.syncCarStatus(saved.carId);

    return this.findOne(saved.id);
  }

  async findAll(params?: {
    search?: string;
    status?: ReservationStatus;
    carId?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: Reservation[]; total: number; page: number; pages: number; perPage: number }> {
    const {
      search,
      status,
      carId,
      customerId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params || {};

    const where: any = { deletedAt: IsNull() };

    if (search) {
      where.notes = Like(`%${search}%`);
    }

    if (status) {
      where.status = status;
    }

    if (carId) {
      where.carId = carId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate && endDate) {
      where.startDate = Between(startDate, endDate);
    } else if (startDate) {
      where.startDate = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.endDate = LessThanOrEqual(endDate);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await this.reservationsRepository.findAndCount({
      where,
      order: { startDate: 'ASC', createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['car', 'customer'],
    });

    data.forEach(r => {
      r.totalDays = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24));
    });

    return { data, total, page, pages: Math.ceil(total / limit), perPage: limit };
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['car', 'customer'],
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    reservation.totalDays = Math.ceil(
      (new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    return reservation;
  }
async update(id: string, updateReservationDto: UpdateReservationDto, userId?: string): Promise<Reservation> {
    const reservation = await this.findOne(id);
    const oldCarId = reservation.carId;
    let carChanged = false;

    if (updateReservationDto.customerId !== undefined) {
      if (updateReservationDto.customerId) {
        const customer = await this.customersRepository.findOne({
          where: { id: updateReservationDto.customerId, deletedAt: IsNull() },
        });
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
        reservation.customerId = updateReservationDto.customerId;
        reservation.customer = customer; // ✅ Explicitly set the customer relation object as well
      } else {
        reservation.customerId = null as any;
        reservation.customer = null as any;
      }
    }

    const newStartDate = updateReservationDto.startDate ? new Date(updateReservationDto.startDate) : null;
    const newEndDate = updateReservationDto.endDate ? new Date(updateReservationDto.endDate) : null;

    const targetCarId = updateReservationDto.carId !== undefined ? updateReservationDto.carId : reservation.carId;

    if (newStartDate || newEndDate || (updateReservationDto.carId !== undefined && updateReservationDto.carId !== reservation.carId)) {
      const start = newStartDate ?? new Date(reservation.startDate);
      const end = newEndDate ?? new Date(reservation.endDate);

      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }

      if (targetCarId) {
        const overlapping = await this.reservationsRepository.findOne({
          where: {
            carId: targetCarId,
            status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
            deletedAt: IsNull(),
            id: Not(reservation.id),
            startDate: LessThan(end),
            endDate: MoreThan(start),
          },
        });

        if (overlapping) {
          throw new ConflictException('Car is not available for the selected dates');
        }
      }
    }

    if (updateReservationDto.status !== undefined) {
      reservation.status = updateReservationDto.status;
    }
    if (updateReservationDto.startDate !== undefined) {
      reservation.startDate = new Date(updateReservationDto.startDate);
    }
    if (updateReservationDto.endDate !== undefined) {
      reservation.endDate = new Date(updateReservationDto.endDate);
    }
    if (updateReservationDto.notes !== undefined) {
      reservation.notes = updateReservationDto.notes;
    }

    if (updateReservationDto.carId !== undefined) {
      if (updateReservationDto.carId) {
        const car = await this.carsRepository.findOne({
          where: { id: updateReservationDto.carId, deletedAt: IsNull() },
        });
        if (!car) {
          throw new NotFoundException('Car not found');
        }
        if (reservation.carId !== updateReservationDto.carId) {
          carChanged = true;
          reservation.carId = updateReservationDto.carId;
          reservation.car = car;
        }
      } else {
        if (reservation.carId) carChanged = true;
        reservation.carId = null as any;
        reservation.car = null as any;
      }
    }

   const saved = await this.reservationsRepository.save(reservation);
    
    await this.syncCarStatus(saved.carId);
    if (carChanged && oldCarId) {
      await this.syncCarStatus(oldCarId); // Free up the old car if car was switched
    }

    return this.findOne(saved.id);
  }
 private async syncCarStatus(carId: string): Promise<void> {
    try {
      const now = new Date();

      // Check if there is any CONFIRMED or ONGOING reservation currently spanning 'now'
      const activeReservation = await this.reservationsRepository.findOne({
        where: {
          carId,
          status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
          deletedAt: IsNull(),
          startDate: LessThanOrEqual(now),
          endDate: MoreThan(now), // If endDate is in the past, this returns null!
        },
      });

      const car = await this.carsRepository.findOne({ where: { id: carId } });
      if (!car || car.status === CarStatus.MAINTENANCE) {
        return;
      }

      // If an active reservation covers right now -> RESERVED, otherwise -> AVAILABLE
      const targetStatus = activeReservation ? CarStatus.RESERVED : CarStatus.AVAILABLE;

      if (car.status !== targetStatus) {
        await this.carsRepository.update(carId, { status: targetStatus });
      }
    } catch (e) {
      this.logger.error('Failed to sync car status', e);
    }
  }

async remove(id: string): Promise<void> {
    const reservation = await this.findOne(id);
    await this.reservationsRepository.softDelete(id);
    await this.syncCarStatus(reservation.carId);
  }

  async confirmReservation(id: string, userId: string): Promise<Reservation> {
    return this.update(id, { status: ReservationStatus.CONFIRMED }, userId);
  }

  async startRental(id: string): Promise<Reservation> {
    return this.update(id, {
      status: ReservationStatus.ONGOING,
    });
  }

/**
   * OPTION A: User says YES -> The car is returned and rental is completed.
   * Car status automatically syncs back to AVAILABLE.
   */
async completeRental(id: string, actualReturnDate?: Date): Promise<Reservation> {
    const reservation = await this.findOne(id);
    const now = new Date();

    // Ensure both confirmed and ongoing rentals can be returned early or completed
    if (![ReservationStatus.CONFIRMED, ReservationStatus.ONGOING].includes(reservation.status)) {
      throw new BadRequestException('Only active or ongoing rentals can be completed');
    }

    const returnDate = actualReturnDate ? new Date(actualReturnDate) : now;

    // Truncate or set the actual return date/end date
    reservation.endDate = returnDate > new Date(reservation.endDate) ? reservation.endDate : returnDate;
    reservation.status = ReservationStatus.COMPLETED;
    reservation.actualReturnDate = returnDate;

    const saved = await this.reservationsRepository.save(reservation);
    
    // Call syncCarStatus without parameters so it automatically checks current date overlap
    await this.syncCarStatus(reservation.carId);

    return saved;
  }
 async extendRental(
    id: string,
    newEndDate?: Date,
    daysToAdd?: number,
    newStartDate?: Date,
  ): Promise<Reservation & { numberOfDays?: number }> {
    const reservation = await this.findOne(id);

    const parseLocalDate = (dateInput: Date | string) => {
      if (typeof dateInput === 'string') {
        const datePart = dateInput.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(year, month - 1, day, 0, 0, 0, 0);
      }
      const d = new Date(dateInput);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    };

    let finalStart = newStartDate ? parseLocalDate(newStartDate) : parseLocalDate(reservation.startDate);
    let finalEnd: Date;

    if (newEndDate) {
      finalEnd = parseLocalDate(newEndDate);
    } else if (daysToAdd) {
      const currentEnd = parseLocalDate(reservation.endDate);
      currentEnd.setDate(currentEnd.getDate() + Number(daysToAdd));
      finalEnd = currentEnd;
    } else {
      finalEnd = parseLocalDate(reservation.endDate);
    }

    if (finalEnd <= finalStart) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check availability overlaps for the new window
    const overlapping = await this.reservationsRepository.findOne({
      where: {
        carId: reservation.carId,
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
        deletedAt: IsNull(),
        id: Not(reservation.id),
        startDate: LessThan(finalEnd),
        endDate: MoreThan(finalStart),
      },
    });

    if (overlapping) {
      throw new ConflictException('Cannot modify: Car is booked for another reservation during this period');
    }

    // Ensure we force them into clean UTC midnights before saving 
    reservation.startDate = new Date(Date.UTC(finalStart.getFullYear(), finalStart.getMonth(), finalStart.getDate()));
    reservation.endDate = new Date(Date.UTC(finalEnd.getFullYear(), finalEnd.getMonth(), finalEnd.getDate()));

    // If it was completed/cancelled, you can optionally reactivate it or keep its status context. 
    // If you want it to become ONGOING or CONFIRMED when dates are adjusted into current time:
    const now = new Date();
    if (reservation.startDate <= now && reservation.endDate > now) {
      reservation.status = ReservationStatus.ONGOING;
    } else if (reservation.startDate > now) {
      reservation.status = ReservationStatus.CONFIRMED;
    }

    const saved = await this.reservationsRepository.save(reservation);
    
    // === CRITICAL: SYNC CAR STATUS IMMEDIATELY AFTER SAVING ===
await this.syncCarStatus(saved.carId);
    const diffTime = Math.abs(finalEnd.getTime() - finalStart.getTime());
    const numberOfDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return {
      ...saved,
      numberOfDays,
    };
  }
  async cancelReservation(id: string, userId: string): Promise<Reservation> {
    return this.update(id, { status: ReservationStatus.CANCELLED }, userId);
  }  // --- AUTOMATED REMINDERS (Déclenchées via API / Vercel Cron) ---

  // --- AUTOMATED REMINDERS (Déclenchées via API / Vercel Cron) ---

 async handleReturnReminders(slot: 'MORNING' | 'EVENING') {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // '2026-10-07'

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const dueToday = await this.reservationsRepository.find({
    where: {
      status: In([ReservationStatus.ONGOING, ReservationStatus.COMPLETED]),
      endDate: Between(todayStart, todayEnd),
      deletedAt: IsNull(),
    },
    relations: ['car', 'customer'],
  });

  for (const res of dueToday) {
    // Check if this reminder was already sent for this slot today
    const alreadySent = await this.reminderLogRepo.findOne({
      where: {
        reservationId: res.id,
        slot: slot,
        reminderDate: todayStr,
      },
    });

    if (alreadySent) {
      continue; // Skip, already notified for this slot today!
    }

    const carMake = res.car?.make || 'Voiture';
    const carModel = res.car?.model || '';

    // Send push notification
    await this.notificationsService.sendPushNotification(
      '🚗 Rappel de retour aujourd\'hui',
      `La location de la voiture ${carMake} ${carModel} arrive à échéance aujourd'hui.`.trim(),
      { reservationId: res.id, type: 'RETURN_REMINDER' }
    );

    // Save log so it never duplicates
    await this.reminderLogRepo.save(
      this.reminderLogRepo.create({
        reservationId: res.id,
        slot: slot,
        reminderDate: todayStr,
      }),
    );
  }
}
  async handleOverdueRentals() {
    this.logger.log('Vérification quotidienne des locations en retard...');
    const now = new Date();

    const overdueReservations = await this.reservationsRepository.find({
      where: {
        status: ReservationStatus.ONGOING,
        endDate: LessThan(now),
        deletedAt: IsNull(),
      },
      relations: ['car', 'customer'],
    });

    for (const res of overdueReservations) {
      const daysLate = Math.floor((now.getTime() - new Date(res.endDate).getTime()) / (1000 * 60 * 60 * 24));
      const delayText = daysLate === 0 ? 'depuis aujourd\'hui' : `avec ${daysLate} jour(s) de retard`;

      const title = '⚠️ Alerte : Véhicule toujours non restitué';
      const body = `La voiture ${res.car?.make} ${res.car?.model} (${res.car?.plateNumber}) louée par ${res.customer?.fullName || 'Client'} est en retard (${delayText}).`;
      
      this.logger.warn(body);

      await this.notificationsService.sendPushNotification(title, body, {
        reservationId: res.id,
        type: 'OVERDUE_ALERT',
      });
    }
  }

  async getStats(): Promise<any> {
    const total = await this.reservationsRepository.count({ where: { deletedAt: IsNull() } });
    const confirmed = await this.reservationsRepository.count({ where: { status: ReservationStatus.CONFIRMED, deletedAt: IsNull() } });
    const ongoing = await this.reservationsRepository.count({ where: { status: ReservationStatus.ONGOING, deletedAt: IsNull() } });
    const completed = await this.reservationsRepository.count({ where: { status: ReservationStatus.COMPLETED, deletedAt: IsNull() } });
    const cancelled = await this.reservationsRepository.count({ where: { status: ReservationStatus.CANCELLED, deletedAt: IsNull() } });

    return {
      total,
      confirmed,
      ongoing,
      completed,
      cancelled,
    };
  }

  async search(query: string): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      where: [
        { notes: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      relations: ['car', 'customer'],
      take: 20,
    });
  }

  async getCalendarEvents(carId: string, startDate: Date, endDate: Date): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      where: {
        carId,
        deletedAt: IsNull(),
        startDate: LessThan(endDate),
        endDate: MoreThan(startDate),
      },
      relations: ['car', 'customer'],
      order: { startDate: 'ASC' },
    });
  }
  
}