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

  /**
   * Implémentation interne de la distance de Levenshtein (évite l'erreur ESM de la lib externe)
   */
  private getLevenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1  // deletion
            ),
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Helper to normalize strings for comparison (lowercase, remove extra spaces/accents)
   */
  private normalizeString(str?: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents (é -> e, etc.)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks if a new name is too similar to an existing customer name using Levenshtein distance.
   */
  private async checkSimilarName(fullName: string, excludeId?: string): Promise<void> {
    const normalizedNewName = this.normalizeString(fullName);
    if (!normalizedNewName) return;

    const existingCustomers = await this.customersRepository.find({
      where: { deletedAt: IsNull() },
      select: ['id', 'fullName'],
    });

    for (const customer of existingCustomers) {
      if (excludeId && customer.id === excludeId) continue;

      const normalizedExisting = this.normalizeString(customer.fullName);
      if (!normalizedExisting) continue;

      if (normalizedExisting === normalizedNewName) {
        throw new ConflictException(`A customer with the name "${customer.fullName}" already exists.`);
      }

      const distance = this.getLevenshteinDistance(normalizedNewName, normalizedExisting);
      const maxLength = Math.max(normalizedNewName.length, normalizedExisting.length);
      const threshold = maxLength <= 6 ? 1 : 2;

      if (distance <= threshold) {
        throw new ConflictException(
          `A very similar customer name already exists: "${customer.fullName}". Please check for duplicates.`
        );
      }
    }
  }

  async create(createCustomerDto: CreateCustomerDto) {
    const dto = { ...createCustomerDto } as Omit<CreateCustomerDto, 'phone' | 'cin'> & {
      phone?: string | null;
      cin?: string | null;
    };

    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() === '') {
      dto.phone = null;
    }
    if (dto.cin !== undefined && dto.cin !== null && dto.cin.trim() === '') {
      dto.cin = null;
    }

    if (dto.phone) {
      const existingByPhone = await this.customersRepository.findOne({
        where: { phone: dto.phone, deletedAt: IsNull() },
      });
      if (existingByPhone) {
        throw new ConflictException('A customer with this phone number already exists.');
      }
    }

    if (dto.cin) {
      const existingByCin = await this.customersRepository.findOne({
        where: { cin: dto.cin, deletedAt: IsNull() },
      });
      if (existingByCin) {
        throw new ConflictException('A customer with this CIN already exists.');
      }
    }

    if (dto.fullName) {
      await this.checkSimilarName(dto.fullName);
    }

    const newCustomer = this.customersRepository.create(dto);
    return await this.customersRepository.save(newCustomer);
  }

  async findAll(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Customer[]; total: number; page: number; pages: number; perPage: number }> {
    const { search, page = 1, limit = 20 } = params || {};
    const base: any = { deletedAt: IsNull() };

    const where: any = search
      ? [
          { ...base, fullName: Like(`%${search}%`) },
          { ...base, phone: Like(`%${search}%`) },
          { ...base, cin: Like(`%${search}%`) },
        ]
      : base;

    const skip = (page - 1) * limit;

    const [data, total] = await this.customersRepository.findAndCount({
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

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByPhone(phone: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { phone, deletedAt: IsNull() },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    const dto = { ...updateCustomerDto } as Omit<UpdateCustomerDto, 'phone' | 'cin'> & {
      phone?: string | null;
      cin?: string | null;
    };

    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() === '') {
      dto.phone = null;
    }
    if (dto.cin !== undefined && dto.cin !== null && dto.cin.trim() === '') {
      dto.cin = null;
    }

    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.customersRepository.findOne({
        where: { phone: dto.phone, deletedAt: IsNull() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Customer with this phone number already exists');
      }
    }

    if (dto.cin && dto.cin !== customer.cin) {
      const existing = await this.customersRepository.findOne({
        where: { cin: dto.cin, deletedAt: IsNull() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Customer with this CIN already exists');
      }
    }

    if (dto.fullName && dto.fullName !== customer.fullName) {
      await this.checkSimilarName(dto.fullName, id);
    }

    Object.assign(customer, dto);
    return await this.customersRepository.save(customer);
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
    return await this.customersRepository.find({
      where: [
        { fullName: Like(`%${query}%`), deletedAt: IsNull() },
        { phone: Like(`%${query}%`), deletedAt: IsNull() },
        { cin: Like(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.customersRepository.count({ where: { deletedAt: IsNull() } });
    return { total };
  }
}