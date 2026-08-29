import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, IsNull, In, LessThan, MoreThan, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Car, CarStatus, CarCategory } from './entities/car.entity';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';

@Injectable()
export class CarsService {
 
constructor(
    @InjectRepository(Car)
    private carsRepository: Repository<Car>,
    @InjectRepository(Reservation)
    private reservationsRepository: Repository<Reservation>,
  ) {}

  

  async create(createCarDto: CreateCarDto): Promise<Car> {
    // Check for duplicate plate number
    const existing = await this.carsRepository.findOne({
      where: { plateNumber: createCarDto.plateNumber, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException('Car with this plate number already exists');
    }

    const car = this.carsRepository.create(createCarDto);
    return this.carsRepository.save(car);
  }

  async findAll(params?: {
    search?: string;
    status?: CarStatus;
    category?: CarCategory;
    minRate?: number;
    maxRate?: number;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: Car[]; total: number; page: number; pages: number; perPage: number }> {
    const {
      search,
      status,
      category,
      minRate,
      maxRate,
      page = 1,
      limit = 20,
    } = params || {};

    // Base filters shared by every branch of the search condition
    const base: any = { deletedAt: IsNull() };
    if (status) {
      base.status = status;
    }
    if (category) {
      base.category = category;
    }

    // Explicitly fix TypeORM operators for relational pricing ranges
    if (minRate !== undefined && maxRate !== undefined) {
      base.dailyRate = Between(minRate, maxRate);
    } else if (minRate !== undefined) {
      base.dailyRate = MoreThanOrEqual(minRate);
    } else if (maxRate !== undefined) {
      base.dailyRate = LessThanOrEqual(maxRate);
    }

    // Search across make, model AND plate number (OR conditions)
    const where: any = search
      ? [
          { ...base, make: Like(`%${search}%`) },
          { ...base, model: Like(`%${search}%`) },
          { ...base, plateNumber: Like(`%${search}%`) },
        ]
      : base;

    const skip = (page - 1) * limit;

    const [data, total] = await this.carsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // `perPage` keeps the response contract consistent across resources.
    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
      perPage: limit,
    };
  }
  async findOne(id: string): Promise<Car> {
    const car = await this.carsRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!car) {
      throw new NotFoundException('Car not found');
    }

    return car;
  }

  async findByPlateNumber(plateNumber: string): Promise<Car> {
    const car = await this.carsRepository.findOne({
      where: { plateNumber, deletedAt: IsNull() },
    });

    if (!car) {
      throw new NotFoundException('Car not found');
    }

    return car;
  }

  async update(id: string, updateCarDto: UpdateCarDto): Promise<Car> {
    const car = await this.findOne(id);

    // Check for duplicate plate number if changed
    if (updateCarDto.plateNumber && updateCarDto.plateNumber !== car.plateNumber) {
      const existing = await this.carsRepository.findOne({
        where: { plateNumber: updateCarDto.plateNumber, deletedAt: IsNull() },
      });

      if (existing) {
        throw new ConflictException('Car with this plate number already exists');
      }
    }

    Object.assign(car, updateCarDto);
    return this.carsRepository.save(car);
  }

  async updateStatus(id: string, status: CarStatus): Promise<Car> {
    const car = await this.findOne(id);
    car.status = status;
    return this.carsRepository.save(car);
  }


  async restore(id: string): Promise<Car> {
    await this.carsRepository.restore(id);
    return this.findOne(id);
  }

  async getAvailableCars(startDate: Date, endDate: Date, category?: string): Promise<Car[]> {
    // Get all available cars first
    const whereClause: any = {
      status: CarStatus.AVAILABLE,
      isActive: true,
      deletedAt: IsNull(),
    };

    if (category) {
      whereClause.category = category;
    }

    const availableCars = await this.carsRepository.find({
      where: whereClause,
    });

    // If no date range provided, return all available cars
    if (!startDate || !endDate) {
      return availableCars;
    }

    // Filter out cars that have overlapping reservations
    const carIds = availableCars.map(car => car.id);
    
    if (carIds.length === 0) {
      return [];
    }

    // Get reservations that overlap with the date range
    const overlappingReservations = await this.reservationsRepository.find({
      where: {
        carId: In(carIds),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING, ReservationStatus.PENDING]),
        deletedAt: IsNull(),
        startDate: LessThan(endDate),
        endDate: MoreThan(startDate),
      },
    });

    // Get unique car IDs that are already reserved
    const reservedCarIds = [...new Set(overlappingReservations.map(r => r.carId))];

    // Filter out reserved cars
    return availableCars.filter(car => !reservedCarIds.includes(car.id));
  }

  async getStats(): Promise<{
    total: number;
    available: number;
    rented: number;
    reserved: number;
    maintenance: number;
    byCategory: any[];
  }> {
    const total = await this.carsRepository.count({ where: { deletedAt: IsNull() } });
    const available = await this.carsRepository.count({
      where: { status: CarStatus.AVAILABLE, deletedAt: IsNull() },
    });
    const rented = await this.carsRepository.count({
where: { status: CarStatus.RESERVED, deletedAt: IsNull() },    });
    const reserved = await this.carsRepository.count({
      where: { status: CarStatus.RESERVED, deletedAt: IsNull() },
    });
    const maintenance = await this.carsRepository.count({
      where: { status: CarStatus.MAINTENANCE, deletedAt: IsNull() },
    });

    const byCategory = await this.carsRepository
      .createQueryBuilder('car')
      .select('car.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('car.deletedAt IS NULL')
      .groupBy('car.category')
      .getRawMany();

    return { total, available, rented, reserved, maintenance, byCategory };
  }

  async search(query: string): Promise<Car[]> {
    return this.carsRepository.find({
      where: [
        { make: Like(`%${query}%`), deletedAt: IsNull() },
        { model: Like(`%${query}%`), deletedAt: IsNull() },
        { plateNumber: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });
  }
  async remove(id: string): Promise<void> {
    // Ensure the car exists before proceeding
    const car = await this.findOne(id);

    // Soft-delete and cancel all active reservations for this car
    await this.reservationsRepository.update(
      { carId: id, deletedAt: IsNull() },
      { deletedAt: new Date(), status: ReservationStatus.CANCELLED }
    );

    // Soft-delete the car
    await this.carsRepository.softDelete(id);
  }
}
