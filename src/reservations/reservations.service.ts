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

    const now = new Date();
    if (startDate <= now && car.status === CarStatus.AVAILABLE) {
      await this.carsRepository.update(car.id, { status: CarStatus.RESERVED });
    }

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

    if (updateReservationDto.customerId !== undefined) {
      if (updateReservationDto.customerId) {
        const customer = await this.customersRepository.findOne({
          where: { id: updateReservationDto.customerId, deletedAt: IsNull() },
        });
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
        reservation.customerId = updateReservationDto.customerId;
      } else {
        reservation.customerId = null as any;
      }
    }

    const newStartDate = updateReservationDto.startDate ? new Date(updateReservationDto.startDate) : null;
    const newEndDate = updateReservationDto.endDate ? new Date(updateReservationDto.endDate) : null;

    if (newStartDate || newEndDate) {
      const start = newStartDate ?? new Date(reservation.startDate);
      const end = newEndDate ?? new Date(reservation.endDate);

      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }

      const overlapping = await this.reservationsRepository.findOne({
        where: {
          carId: reservation.carId,
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

    const saved = await this.reservationsRepository.save(reservation);
    await this.syncCarStatus(reservation.carId, saved.status);

    return saved;
  }

  private async syncCarStatus(carId: string, status: ReservationStatus): Promise<void> {
    try {
      const now = new Date();
      let target: CarStatus | null = null;

      if (status === ReservationStatus.ONGOING) {
        target = CarStatus.RESERVED;
      } else if (status === ReservationStatus.CONFIRMED) {
        const activeNowReservation = await this.reservationsRepository.findOne({
          where: {
            carId,
            status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
            deletedAt: IsNull(),
            startDate: LessThanOrEqual(now),
            endDate: MoreThan(now),
          },
        });
        target = activeNowReservation ? CarStatus.RESERVED : null;
      } else if (
        status === ReservationStatus.COMPLETED ||
        status === ReservationStatus.CANCELLED
      ) {
        const stillBusy = await this.reservationsRepository.findOne({
          where: {
            carId,
            status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
            deletedAt: IsNull(),
            startDate: LessThanOrEqual(now),
            endDate: MoreThan(now),
          },
        });
        target = stillBusy ? CarStatus.RESERVED : CarStatus.AVAILABLE;
      }

      if (target) {
        const car = await this.carsRepository.findOne({ where: { id: carId } });
        if (car && car.status !== CarStatus.MAINTENANCE) {
          await this.carsRepository.update(carId, { status: target });
        }
      }
    } catch (e) {
      this.logger.error('Failed to sync car status', e);
    }
  }

  async remove(id: string): Promise<void> {
    const reservation = await this.findOne(id);
    await this.reservationsRepository.softDelete(id);
    await this.syncCarStatus(reservation.carId, ReservationStatus.CANCELLED);
  }

  async confirmReservation(id: string, userId: string): Promise<Reservation> {
    return this.update(id, { status: ReservationStatus.CONFIRMED }, userId);
  }

  async startRental(id: string): Promise<Reservation> {
    return this.update(id, {
      status: ReservationStatus.ONGOING,
    });
  }

  async completeRental(
    id: string,
    actualReturnDate?: Date,
    newEndDate?: Date,
  ): Promise<Reservation> {
    const reservation = await this.findOne(id);
    const now = new Date();

    if (now < reservation.startDate && reservation.status !== ReservationStatus.ONGOING) {
      throw new BadRequestException('This reservation has not started yet');
    }

    const finalEndDate = newEndDate ? new Date(newEndDate) : new Date(reservation.endDate);

    if (newEndDate && finalEndDate > new Date(reservation.endDate)) {
      const overlapping = await this.reservationsRepository.findOne({
        where: {
          carId: reservation.carId,
          status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
          deletedAt: IsNull(),
          id: Not(reservation.id),
          startDate: LessThan(finalEndDate),
          endDate: MoreThan(reservation.startDate),
        },
      });

      if (overlapping) {
        throw new ConflictException('Cannot extend: Car is booked for another reservation during this period');
      }
      reservation.endDate = finalEndDate;
    }

    reservation.status = ReservationStatus.COMPLETED;
    reservation.actualReturnDate = actualReturnDate ? new Date(actualReturnDate) : now;

    const saved = await this.reservationsRepository.save(reservation);
    await this.syncCarStatus(reservation.carId, saved.status);

    return saved;
  }

  async cancelReservation(id: string, userId: string): Promise<Reservation> {
    return this.update(id, { status: ReservationStatus.CANCELLED }, userId);
  }

  // --- AUTOMATED REMINDERS (Déclenchées via API / Vercel Cron) ---

  async handleReturnReminders() {
    this.logger.log('Vérification des retours prévus aujourd\'hui...');
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dueToday = await this.reservationsRepository.find({
      where: {
        status: ReservationStatus.ONGOING,
        endDate: Between(todayStart, todayEnd),
        deletedAt: IsNull(),
      },
      relations: ['car', 'customer'],
    });

    for (const res of dueToday) {
      const title = '🚗 Rappel de retour aujourd\'hui';
      const body = `La voiture ${res.car?.make} ${res.car?.model} (${res.car?.plateNumber}) louée par ${res.customer?.fullName || 'Client'} doit être retournée aujourd'hui.`;
      
      this.logger.log(body);

      await this.notificationsService.sendPushNotification(title, body, {
        reservationId: res.id,
        type: 'RETURN_REMINDER',
      });
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