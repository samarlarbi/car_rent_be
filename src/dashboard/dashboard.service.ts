import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, In } from 'typeorm';
import { Car, CarStatus } from '../cars/entities/car.entity';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { Customer } from '../customers/entities/customer.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Car)
    private carsRepository: Repository<Car>,
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async getDashboardStats(): Promise<{
    cars: {
      total: number;
      available: number;
      rented: number;
      reserved: number;
      maintenance: number;
    };
    reservations: {
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
    };
    customers: {
      total: number;
    };
  }> {
    // Car stats
    const totalCars = await this.carsRepository.count({ where: { deletedAt: IsNull() } });
    const availableCars = await this.carsRepository.count({
      where: { status: CarStatus.AVAILABLE, deletedAt: IsNull() },
    });
    const rentedCars = await this.carsRepository.count({
      where: { status: CarStatus.RESERVED, deletedAt: IsNull() },
    });
    const reservedCars = await this.carsRepository.count({
      where: { status: CarStatus.RESERVED, deletedAt: IsNull() },
    });
    const maintenanceCars = await this.carsRepository.count({
      where: { status: CarStatus.MAINTENANCE, deletedAt: IsNull() },
    });

    // Reservation stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    const totalReservations = await this.reservationsRepository.count({ where: { deletedAt: IsNull() } });
    const pendingReservations = await this.reservationsRepository.count({
      where: { status: ReservationStatus.CONFIRMED, deletedAt: IsNull() },
    });
    const confirmedReservations = await this.reservationsRepository.count({
      where: { status: ReservationStatus.CONFIRMED, deletedAt: IsNull() },
    });
    const ongoingReservations = await this.reservationsRepository.count({
      where: { status: ReservationStatus.ONGOING, deletedAt: IsNull() },
    });
    const completedReservations = await this.reservationsRepository.count({
      where: { status: ReservationStatus.COMPLETED, deletedAt: IsNull() },
    });
    const cancelledReservations = await this.reservationsRepository.count({
      where: { status: ReservationStatus.CANCELLED, deletedAt: IsNull() },
    });

    const todayPickups = await this.reservationsRepository.count({
      where: {
        startDate: Between(today, tomorrow),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED]),
        deletedAt: IsNull(),
      },
    });

    const todayReturns = await this.reservationsRepository.count({
      where: {
        endDate: Between(today, tomorrow),
        status: In([ReservationStatus.ONGOING]),
        deletedAt: IsNull(),
      },
    });

    const upcomingPickups = await this.reservationsRepository.count({
      where: {
        startDate: Between(tomorrow, next7Days),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED]),
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

    // Customer stats
    const totalCustomers = await this.customersRepository.count({ where: { deletedAt: IsNull() } });

    return {
      cars: {
        total: totalCars,
        available: availableCars,
        rented: rentedCars,
        reserved: reservedCars,
        maintenance: maintenanceCars,
      },
      reservations: {
        total: totalReservations,
        pending: pendingReservations,
        confirmed: confirmedReservations,
        ongoing: ongoingReservations,
        completed: completedReservations,
        cancelled: cancelledReservations,
        todayPickups,
        todayReturns,
        upcomingPickups,
        upcomingReturns,
      },
      customers: {
        total: totalCustomers,
      },
    };
  }

  async getUpcomingReservations(days: number = 7): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    return this.reservationsRepository.find({
      where: {
        startDate: Between(today, endDate),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED]),
        deletedAt: IsNull(),
      },
      order: { startDate: 'ASC' },
      take: 10,
    });
  }

  async getTodayActivity(): Promise<{
    pickups: any[];
    returns: any[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pickups = await this.reservationsRepository.find({
      where: {
        startDate: Between(today, tomorrow),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED]),
        deletedAt: IsNull(),
      },
      order: { startDate: 'ASC' },
    });

    const returns = await this.reservationsRepository.find({
      where: {
        endDate: Between(today, tomorrow),
        status: In([ReservationStatus.ONGOING]),
        deletedAt: IsNull(),
      },
      order: { endDate: 'ASC' },
    });

    return { pickups, returns };
  }

  async getAvailableCarsCount(): Promise<number> {
    return this.carsRepository.count({
      where: { status: CarStatus.AVAILABLE, deletedAt: IsNull() },
    });
  }

  async getActiveReservationsCount(): Promise<number> {
    return this.reservationsRepository.count({
      where: {
        status: In([ReservationStatus.ONGOING, ReservationStatus.CONFIRMED]),
        deletedAt: IsNull(),
      },
    });
    
  }
  async getTodayEnds(): Promise<any[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.reservationsRepository.find({
    where: {
      endDate: Between(today, tomorrow),
      status: In([
        ReservationStatus.CONFIRMED,
        ReservationStatus.ONGOING,
      ]),
      deletedAt: IsNull(),
    },
    relations: ['car', 'customer'],
    order: { endDate: 'ASC' },
  });
}
}