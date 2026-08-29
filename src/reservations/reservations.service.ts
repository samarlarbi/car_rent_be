import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, Between, LessThan, MoreThan, In, Not, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { Car, CarStatus } from '../cars/entities/car.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    @InjectRepository(Car)
    private carsRepository: Repository<Car>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  private async generateReservationNumber(): Promise<string> {
    // Retry a few times in the (rare) event of a random-number collision
    // with the unique reservationNumber column.
    for (let attempt = 0; attempt < 5; attempt++) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
      const candidate = `RES-${year}${month}-${random}`;
      const exists = await this.reservationsRepository.findOne({
        where: { reservationNumber: candidate },
      });
      if (!exists) return candidate;
    }
    // Practically unreachable; fall back to a timestamp-based number.
    return `RES-${Date.now()}`;
  }

  async create(createReservationDto: CreateReservationDto, userId: string): Promise<Reservation> {
    const startDate = new Date(createReservationDto.startDate);
    const endDate = new Date(createReservationDto.endDate);

    // Validate dates
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check if car exists
    const car = await this.carsRepository.findOne({
      where: { id: createReservationDto.carId, deletedAt: IsNull() },
    });

    if (!car) {
      throw new NotFoundException('Car not found');
    }

    // Check if customer exists
   // Customer is optional. Only look it up / validate it if an ID was provided.
let customer: Customer | null = null;
if (createReservationDto.customerId) {
  customer = await this.customersRepository.findOne({
    where: { id: createReservationDto.customerId, deletedAt: IsNull() },
  });

  if (!customer) {
    throw new NotFoundException('Customer not found');
  }

  if (customer.isBlacklisted) {
    throw new BadRequestException('Customer is blacklisted');
  }
}
    // Check for overlapping reservations
    const overlapping = await this.reservationsRepository.findOne({
      where: {
        carId: createReservationDto.carId,
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING, ReservationStatus.PENDING]),
        deletedAt: IsNull(),
        startDate: LessThan(endDate),
        endDate: MoreThan(startDate),
      },
    });

    if (overlapping) {
      throw new ConflictException('Car is not available for the selected dates');
    }

    const reservationNumber = await this.generateReservationNumber();

   // Calculate total days and price. Fall back to the car's own dailyRate
// if the client didn't send one (dailyRate is optional now).
const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
const discount = createReservationDto.discount || 0;
const effectiveDailyRate = createReservationDto.dailyRate ?? car.dailyRate ?? 0;
const totalPrice = Math.max(0, (effectiveDailyRate * totalDays) - discount);

const reservation = this.reservationsRepository.create({
  reservationNumber,
  carId: createReservationDto.carId,
  customerId: createReservationDto.customerId ?? null,
   startDate,
      endDate,
      dailyRate: effectiveDailyRate,
      discount,
      totalPrice,
      depositAmount: createReservationDto.depositAmount || 0,
      pickupLocation: createReservationDto.pickupLocation,
      dropoffLocation: createReservationDto.dropoffLocation,
      notes: createReservationDto.notes,
      status: ReservationStatus.PENDING,
    });

    const saved = await this.reservationsRepository.save(reservation);

    // Keep the car status in sync: a booked car is no longer "available".
    if (car.status === CarStatus.AVAILABLE) {
      await this.carsRepository.update(car.id, { status: CarStatus.RESERVED });
    }

    return saved;
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
      where.reservationNumber = Like(`%${search}%`);
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
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Add computed totalDays
    data.forEach(r => {
      r.totalDays = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24));
    });

    // `perPage` is part of the contract the Flutter client relies on for
    // infinite-scroll pagination (hasMore = fetched >= perPage).
    return { data, total, page, pages: Math.ceil(total / limit), perPage: limit };
  }

  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id, deletedAt: IsNull() },
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

    // Handle deposit payment
    if (updateReservationDto.depositPaid && !reservation.depositPaid) {
      (updateReservationDto as any).depositPaidAt = new Date();
    }

    // If the dates change, make sure the new window does not overlap another
    // active reservation for the same car (excluding this one).
    const newStartDate = updateReservationDto.startDate
      ? new Date(updateReservationDto.startDate)
      : null;
    const newEndDate = updateReservationDto.endDate
      ? new Date(updateReservationDto.endDate)
      : null;

    if (newStartDate || newEndDate) {
      const start = newStartDate ?? new Date(reservation.startDate);
      const end = newEndDate ?? new Date(reservation.endDate);

      if (end <= start) {
        throw new BadRequestException('End date must be after start date');
      }

      const overlapping = await this.reservationsRepository.findOne({
        where: {
          carId: reservation.carId,
          status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING, ReservationStatus.PENDING]),
          deletedAt: IsNull(),
          startDate: LessThan(end),
          endDate: MoreThan(start),
        },
      });

      if (overlapping && overlapping.id !== reservation.id) {
        throw new ConflictException('Car is not available for the selected dates');
      }
    }

    // Handle status transitions
    if (updateReservationDto.status && updateReservationDto.status !== reservation.status) {
      const newStatus = updateReservationDto.status;

      if (newStatus === ReservationStatus.CONFIRMED) {
        (updateReservationDto as any).confirmedBy = userId;
        (updateReservationDto as any).confirmedAt = new Date();
      } else if (newStatus === ReservationStatus.ONGOING) {
        (updateReservationDto as any).actualPickupDate = new Date();
      } else if (newStatus === ReservationStatus.COMPLETED) {
        (updateReservationDto as any).completedBy = userId;
        (updateReservationDto as any).completedAt = new Date();
        (updateReservationDto as any).actualReturnDate = new Date();
        
        // ✂️ Truncate the endDate to today's actual return date
        const actualReturn = new Date();
        const start = new Date(reservation.startDate);
        
        // Ensure end date doesn't precede start date
        if (actualReturn >= start) {
          (updateReservationDto as any).endDate = actualReturn;
          
          // Recalculate total days and price based on the early return
          const totalDays = Math.max(1, Math.ceil((actualReturn.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
          (updateReservationDto as any).totalPrice = Math.max(0, (reservation.dailyRate * totalDays) - (reservation.discount || 0));
        }}
    }

    Object.assign(reservation, updateReservationDto);
    const saved = await this.reservationsRepository.save(reservation);

    // Keep the car status in sync with the reservation lifecycle.
    await this.syncCarStatus(reservation.carId, saved.status);

    return saved;
  }

  /// Maps a reservation status to the car status it implies and applies it
  /// only when it moves the car forward (never unlocks a car that still has
  /// other active reservations).
  private async syncCarStatus(carId: string, status: ReservationStatus): Promise<void> {
  try {
    let target: CarStatus | null = null;
    if (
      status === ReservationStatus.ONGOING ||
      status === ReservationStatus.CONFIRMED ||
      status === ReservationStatus.PENDING
    ) {
      target = CarStatus.RESERVED;
    } else if (
      status === ReservationStatus.COMPLETED ||
      status === ReservationStatus.CANCELLED
    ) {
      // Only free the car when no other active reservation holds it.
      const stillBusy = await this.reservationsRepository.findOne({
        where: {
          carId,
          status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING, ReservationStatus.PENDING]),
          deletedAt: IsNull(),
        },
      });
      target = stillBusy ? CarStatus.RESERVED : CarStatus.AVAILABLE;
    }

    if (target) {
      await this.carsRepository.update(carId, { status: target });
    }
  } catch (e) {
    console.error('Failed to sync car status', e);
  }
}

  async remove(id: string): Promise<void> {
    const reservation = await this.findOne(id);
    await this.reservationsRepository.softDelete(id);
    // Deleting frees the car unless another active reservation holds it.
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

  async completeRental(id: string, userId: string, returnData?: {
    returnOdometer?: number;
    returnNotes?: string;
  }): Promise<Reservation> {
    const updates: any = {
      status: ReservationStatus.COMPLETED,
      ...returnData,
    };

    return this.update(id, updates, userId);
  }

  async cancelReservation(id: string, userId: string, reason: string): Promise<Reservation> {
    return this.update(id, {
      status: ReservationStatus.CANCELLED,
      cancelReason: reason,
    });
  }

  async recordPayment(id: string, amount: number, userId?: string): Promise<Reservation> {
    const reservation = await this.findOne(id);
    
    reservation.amountPaid += amount;
    reservation.isFullyPaid = reservation.amountPaid >= reservation.totalPrice;

    return this.reservationsRepository.save(reservation);
  }

  async recordDeposit(id: string, amount: number, method: string): Promise<Reservation> {
    return this.update(id, {
      depositAmount: amount,
      depositPaid: true,
      depositMethod: method,
    });
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    todayPickups: number;
    todayReturns: number;
    upcomingPickups: number;
    upcomingReturns: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const total = await this.reservationsRepository.count({ where: { deletedAt: IsNull() } });

    const pending = await this.reservationsRepository.count({ where: { status: ReservationStatus.PENDING, deletedAt: IsNull() } });
    const confirmed = await this.reservationsRepository.count({ where: { status: ReservationStatus.CONFIRMED, deletedAt: IsNull() } });
    const ongoing = await this.reservationsRepository.count({ where: { status: ReservationStatus.ONGOING, deletedAt: IsNull() } });
    const completed = await this.reservationsRepository.count({ where: { status: ReservationStatus.COMPLETED, deletedAt: IsNull() } });
    const cancelled = await this.reservationsRepository.count({ where: { status: ReservationStatus.CANCELLED, deletedAt: IsNull() } });

    const todayPickups = await this.reservationsRepository.count({
      where: { startDate: Between(today, tomorrow), status: In([ReservationStatus.CONFIRMED, ReservationStatus.PENDING]), deletedAt: IsNull() },
    });

    const todayReturns = await this.reservationsRepository.count({
      where: { endDate: Between(today, tomorrow), status: In([ReservationStatus.ONGOING]), deletedAt: IsNull() },
    });

    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    const upcomingPickups = await this.reservationsRepository.count({
      where: {
        startDate: Between(tomorrow, next7Days),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.PENDING]),
        deletedAt: IsNull(),
      },
    });

    const upcomingReturns = await this.reservationsRepository.count({
      where: {
        endDate: Between(tomorrow, next7Days),
        status: In([ReservationStatus.ONGOING]),
        deletedAt: IsNull(),
      },
    });

    return {
      total,
      pending,
      confirmed,
      ongoing,
      completed,
      cancelled,
      todayPickups,
      todayReturns,
      upcomingPickups,
      upcomingReturns,
    };
  }

  async getCalendarEvents(carId: string, startDate: Date, endDate: Date): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      where: {
        carId,
        deletedAt: IsNull(),
        startDate: LessThan(endDate),
        endDate: MoreThan(startDate),
      },
      order: { startDate: 'ASC' },
    });
  }

  async search(query: string): Promise<Reservation[]> {
    return this.reservationsRepository.find({
      where: [
        { reservationNumber: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });
  }
}