import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, In, LessThan, MoreThan } from 'typeorm';
import { Car, CarStatus } from './entities/car.entity';
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
    const existing = await this.carsRepository.findOne({
      where: { matricule: createCarDto.matricule, deletedAt: IsNull() },
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
    page?: number;
    limit?: number;
  }): Promise<{ data: Car[]; total: number; page: number; pages: number; perPage: number }> {
    const {
      search,
      status,
      page = 1,
      limit = 20,
    } = params || {};

    const base: any = { deletedAt: IsNull() };
    if (status) {
      base.status = status;
    }

    const where: any = search
      ? [
          { ...base, marque: Like(`%${search}%`) },
          { ...base, matricule: Like(`%${search}%`) },
          { ...base, numeroChassis: Like(`%${search}%`) },
          { ...base, codeEngin: Like(`%${search}%`) },
          { ...base, adresse: Like(`%${search}%`) },
        ]
      : base;

    const skip = (page - 1) * limit;

    const [data, total] = await this.carsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

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

  async findByPlateNumber(matricule: string): Promise<Car> {
    const car = await this.carsRepository.findOne({
      where: { matricule, deletedAt: IsNull() },
    });

    if (!car) {
      throw new NotFoundException('Car not found');
    }

    return car;
  }

  async update(id: string, updateCarDto: UpdateCarDto): Promise<Car> {
    const car = await this.findOne(id);

    if (updateCarDto.matricule && updateCarDto.matricule !== car.matricule) {
      const existing = await this.carsRepository.findOne({
        where: { matricule: updateCarDto.matricule, deletedAt: IsNull() },
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

  async getAvailableCars(startDate: Date, endDate: Date): Promise<Car[]> {
    const availableCars = await this.carsRepository.find({
      where: {
        status: CarStatus.AVAILABLE,
        deletedAt: IsNull(),
      },
    });

    if (!startDate || !endDate) {
      return availableCars;
    }

    const carIds = availableCars.map(car => car.id);
    if (carIds.length === 0) {
      return [];
    }

    const overlappingReservations = await this.reservationsRepository.find({
      where: {
        carId: In(carIds),
        status: In([ReservationStatus.CONFIRMED, ReservationStatus.ONGOING]),
        deletedAt: IsNull(),
        startDate: LessThan(endDate),
        endDate: MoreThan(startDate),
      },
    });

    const reservedCarIds = [...new Set(overlappingReservations.map(r => r.carId))];

    return availableCars.filter(car => !reservedCarIds.includes(car.id));
  }

  async getStats(): Promise<{
    total: number;
    available: number;
    rented: number;
    reserved: number;
    maintenance: number;
  }> {
    const total = await this.carsRepository.count({ where: { deletedAt: IsNull() } });
    const available = await this.carsRepository.count({
      where: { status: CarStatus.AVAILABLE, deletedAt: IsNull() },
    });
    const rented = await this.carsRepository.count({
      where: { status: CarStatus.RESERVED, deletedAt: IsNull() },
    });
    const reserved = await this.carsRepository.count({
      where: { status: CarStatus.RESERVED, deletedAt: IsNull() },
    });
    const maintenance = await this.carsRepository.count({
      where: { status: CarStatus.MAINTENANCE, deletedAt: IsNull() },
    });

    return { total, available, rented, reserved, maintenance };
  }

  async search(query: string): Promise<Car[]> {
    return this.carsRepository.find({
      where: [
        { marque: Like(`%${query}%`), deletedAt: IsNull() },
        { matricule: Like(`%${query}%`), deletedAt: IsNull() },
        { numeroChassis: Like(`%${query}%`), deletedAt: IsNull() },
        { codeEngin: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.reservationsRepository.update(
      { carId: id, deletedAt: IsNull() },
      { deletedAt: new Date(), status: ReservationStatus.CANCELLED }
    );

    await this.carsRepository.softDelete(id);
  }
}