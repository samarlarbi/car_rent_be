import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, MoreThan } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    const dto = { ...createCustomerDto } as CreateCustomerDto & {
      email?: string | null;
      phone?: string | null;
    };

    // Normalize empty strings to null so the unique constraints on
    // email/phone never trip on blank values (500 errors otherwise).
    if (dto.email !== undefined && dto.email !== null && dto.email.trim() === '') {
      dto.email = null;
    }
    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() === '') {
      dto.phone = null;
    }

    // Only check for duplicates if an email was actually provided
    if (dto.email) {
      const existingCustomer = await this.customersRepository.findOne({
        where: { email: dto.email },
      });

      if (existingCustomer) {
        throw new ConflictException('A customer with this email already exists.');
      }
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
    isBlacklisted?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: Customer[]; total: number; page: number; pages: number; perPage: number }> {
    const {
      search,
      isBlacklisted,
      page = 1,
      limit = 20,
    } = params || {};

    const base: any = { deletedAt: IsNull() };
    if (isBlacklisted !== undefined) {
      base.isBlacklisted = isBlacklisted;
    }

    // Search across first name, last name, email AND phone (OR conditions)
    const where: any = search
      ? [
          { ...base, firstName: Like(`%${search}%`) },
          { ...base, lastName: Like(`%${search}%`) },
          { ...base, email: Like(`%${search}%`) },
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
    data.forEach(c => {
      c.fullName = `${c.firstName} ${c.lastName}`;
    });

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

    customer.fullName = `${customer.firstName} ${customer.lastName}`;
    return customer;
  }

  async findByEmail(email: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { email, deletedAt: IsNull() },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    customer.fullName = `${customer.firstName} ${customer.lastName}`;
    return customer;
  }

  async findByPhone(phone: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { phone, deletedAt: IsNull() },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    customer.fullName = `${customer.firstName} ${customer.lastName}`;
    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    const dto = { ...updateCustomerDto } as UpdateCustomerDto & {
      email?: string | null;
      phone?: string | null;
    };

    // Normalize empty strings to null so unique constraints never trip
    if (dto.email !== undefined && dto.email !== null && dto.email.trim() === '') {
      dto.email = null;
    }
    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() === '') {
      dto.phone = null;
    }

    // Check for duplicate email if changed
    if (dto.email && dto.email !== customer.email) {
      const existing = await this.customersRepository.findOne({
        where: { email: dto.email, deletedAt: IsNull() },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Customer with this email already exists');
      }
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

    // Handle blacklisting
    if (updateCustomerDto.isBlacklisted && !customer.isBlacklisted) {
      (updateCustomerDto as any).blacklistedAt = new Date().toISOString();
    } else if (updateCustomerDto.isBlacklisted === false) {
      updateCustomerDto.blacklistReason = null;
      (updateCustomerDto as any).blacklistedAt = null;
    }

    Object.assign(customer, dto);
    return this.customersRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
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
        { email: Like(`%${query}%`), deletedAt: IsNull() },
        { phone: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });

    customers.forEach(c => {
      c.fullName = `${c.firstName} ${c.lastName}`;
    });

    return customers;
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    blacklisted: number;
    withExpiringLicenses: number;
  }> {
    const total = await this.customersRepository.count({ where: { deletedAt: IsNull() } });
    const active = await this.customersRepository.count({
      where: { isActive: true, deletedAt: IsNull() },
    });
    const blacklisted = await this.customersRepository.count({
      where: { isBlacklisted: true, deletedAt: IsNull() },
    });

    // Customers with licenses expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const withExpiringLicenses = await this.customersRepository.count({
      where: {
        drivingLicenseExpiry: MoreThan(new Date()),
        deletedAt: IsNull(),
      },
    });

    return { total, active, blacklisted, withExpiringLicenses };
  }

  async incrementTotalRentals(id: string, amountSpent: number): Promise<void> {
    await this.customersRepository.increment(
      { id },
      'totalRentals',
      1,
    );
    await this.customersRepository.increment(
      { id },
      'totalSpent',
      amountSpent,
    );
  }
}