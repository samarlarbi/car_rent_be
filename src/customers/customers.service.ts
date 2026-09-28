import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  /// "John Doe", or just "John" when there is no last name (avoids "John null").
  private withFullName<T extends Customer>(customer: T): T {
    customer.fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    return customer;
  }

  async create(createCustomerDto: CreateCustomerDto) {
    const dto = { ...createCustomerDto } as Omit<CreateCustomerDto, 'phone'> & {
      phone?: string | null;
    };

    // Normalize empty strings to null so the unique constraint on
    // phone never trips on blank values (500 errors otherwise).
    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() === '') {
      dto.phone = null;
    }

    // Only check for duplicates if a phone was actually provided
    if (dto.phone) {
      const existingByPhone = await this.customersRepository.findOne({
        where: { phone: dto.phone },
      });

      if (existingByPhone) {
        throw new ConflictException('A customer with this phone number already exists.');
      }
    }

    const newCustomer = this.customersRepository.create(dto);
    return await this.customersRepository.save(newCustomer);
  }

  async findAll(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Customer[]; total: number; page: number; pages: number; perPage: number }> {
    const {
      search,
      page = 1,
      limit = 20,
    } = params || {};

    const base: any = { deletedAt: IsNull() };

    // Search across first name, last name AND phone (OR conditions)
    const where: any = search
      ? [
          { ...base, firstName: Like(`%${search}%`) },
          { ...base, lastName: Like(`%${search}%`) },
          { ...base, phone: Like(`%${search}%`) },
        ]
      : base;

    const skip = (page - 1) * limit;

    const [data, total] = await this.customersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Add computed fullName
    data.forEach(c => this.withFullName(c));

    // `perPage` keeps the response contract consistent with reservations.
    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
      perPage: limit,
    };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.withFullName(customer);
  }

  async findByPhone(phone: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { phone, deletedAt: IsNull() },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.withFullName(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    const dto = { ...updateCustomerDto } as Omit<UpdateCustomerDto, 'phone'> & {
      phone?: string | null;
    };

    // Normalize empty strings to null so the unique constraint never trips
    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() === '') {
      dto.phone = null;
    }

    // Check for duplicate phone if changed
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.customersRepository.findOne({
        where: { phone: dto.phone, deletedAt: IsNull() },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Customer with this phone number already exists');
      }
    }

    Object.assign(customer, dto);
    const saved = await this.customersRepository.save(customer);
    return this.withFullName(saved);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.customersRepository.softDelete(id);
  }

  async restore(id: string): Promise<Customer> {
    await this.customersRepository.restore(id);
    return this.findOne(id);
  }

  async search(query: string): Promise<Customer[]> {
    const customers = await this.customersRepository.find({
      where: [
        { firstName: Like(`%${query}%`), deletedAt: IsNull() },
        { lastName: Like(`%${query}%`), deletedAt: IsNull() },
        { phone: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });

    customers.forEach(c => this.withFullName(c));

    return customers;
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.customersRepository.count({ where: { deletedAt: IsNull() } });
    return { total };
  }
}