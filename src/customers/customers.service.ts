import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull, DeepPartial } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const NULLABLE_STRING_FIELDS = ['phone', 'phone2', 'address', 'city'];

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  /**
   * Internal Levenshtein distance (avoids the ESM error of the external lib)
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
              matrix[i - 1][j] + 1, // deletion
            ),
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Normalize strings for comparison (lowercase, remove accents / extra spaces)
   */
  private normalizeString(str?: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Trims optional string fields and turns empty strings into null.
   */
  private blankToNull(input: Record<string, any>): Record<string, any> {
    const dto = { ...input };
    for (const key of NULLABLE_STRING_FIELDS) {
      const value = dto[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        dto[key] = trimmed === '' ? null : trimmed;
      }
    }
    if (typeof dto.fullName === 'string') {
      dto.fullName = dto.fullName.trim();
    }
    return dto;
  }

  /**
   * Checks if a new name is too similar to an existing customer name.
   */
  private async checkSimilarName(
    fullName: string,
    excludeId?: string,
  ): Promise<void> {
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
        throw new ConflictException(
          `A customer with the name "${customer.fullName}" already exists.`,
        );
      }

      const distance = this.getLevenshteinDistance(
        normalizedNewName,
        normalizedExisting,
      );
      const maxLength = Math.max(
        normalizedNewName.length,
        normalizedExisting.length,
      );
      const threshold = maxLength <= 6 ? 1 : 2;

      if (distance <= threshold) {
        throw new ConflictException(
          `A very similar customer name already exists: "${customer.fullName}". Please check for duplicates.`,
        );
      }
    }
  }

  /**
   * A customer is a duplicate when another active customer has the same
   * (normalized) name AND the same phone. Two different people may share a
   * phone number (family), and the same name with a different phone is allowed.
   * Rows without a phone are compared by name among other rows without a phone.
   */
  private async checkDuplicate(
    fullName: string | undefined,
    phone: string | null | undefined,
    excludeId?: string,
  ): Promise<void> {
    const target = this.normalizeString(fullName);
    if (!target) return;

    const sameContact = await this.customersRepository.find({
      where: { deletedAt: IsNull(), phone: phone ? phone : IsNull() } as any,
      select: ['id', 'fullName', 'phone'],
    });

    for (const c of sameContact) {
      if (excludeId && c.id === excludeId) continue;
      if (this.normalizeString(c.fullName) === target) {
        throw new ConflictException(
          phone
            ? `A customer named "${c.fullName}" with this phone number already exists.`
            : `A customer named "${c.fullName}" already exists.`,
        );
      }
    }
  }

  async create(
    createCustomerDto: CreateCustomerDto,
    options: { skipSimilarCheck?: boolean } = {},
  ) {
    const dto = this.blankToNull(createCustomerDto as Record<string, any>);

    await this.checkDuplicate(dto.fullName, dto.phone);

    if (dto.fullName && !options.skipSimilarCheck) {
      await this.checkSimilarName(dto.fullName);
    }

    const newCustomer = this.customersRepository.create(dto as any);
    return await this.customersRepository.save(newCustomer as any);
  }

  /**
   * Import rows and MERGE them into existing customers.
   * - Same name + same phone  -> existing customer, blank fields are filled
   * - Same name, existing has no phone -> existing customer gets the phone (+ other blanks)
   * - Same name, other phone -> treated as a different person, created
   * - No match -> created
   * Existing non-empty values are never overwritten.
   */
  async importRows(
    rows: {
      row: number;
      fullName: string;
      phone?: string;
      phone2?: string;
      address?: string;
      city?: string;
      allowMatch: boolean; // false when the sheet row has no real name
    }[],
  ) {
    const result = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as { row: number; reason: string }[],
    };

    const all = await this.customersRepository.find({
      where: { deletedAt: IsNull() },
    });
    const byName = new Map<string, Customer[]>();
    const index = (c: Customer) => {
      const key = this.normalizeString(c.fullName);
      if (!key) return;
      const list = byName.get(key) ?? [];
      list.push(c);
      byName.set(key, list);
    };
    all.forEach(index);

    for (const r of rows) {
      try {
        const candidates = r.allowMatch
          ? (byName.get(this.normalizeString(r.fullName)) ?? [])
          : [];

        let target: Customer | undefined;
        if (r.phone) {
          target =
            candidates.find((c) => c.phone === r.phone) ??
            candidates.find((c) => !c.phone);
        } else {
          target = candidates[0];
        }

        if (!target) {
          const data: DeepPartial<Customer> = { fullName: r.fullName };
          if (r.phone) data.phone = r.phone;
          if (r.phone2) data.phone2 = r.phone2;
          if (r.address) data.address = r.address;
          if (r.city) data.city = r.city;
          const created = await this.customersRepository.save(
            this.customersRepository.create(data),
          );
          index(created);
          result.imported++;
          continue;
        }

        // Fill blanks only
        const patch: Partial<Customer> = {};
        if (!target.phone && r.phone) patch.phone = r.phone;
        const finalPhone = patch.phone ?? target.phone;
        if (!target.phone2 && r.phone2 && r.phone2 !== finalPhone) {
          patch.phone2 = r.phone2;
        }
        if (!target.address && r.address) patch.address = r.address;
        if (!target.city && r.city) patch.city = r.city;

        if (Object.keys(patch).length > 0) {
          Object.assign(target, patch);
          await this.customersRepository.save(target);
          result.updated++;
        } else {
          result.skipped++;
          result.errors.push({
            row: r.row,
            reason: 'Déjà existant, rien à mettre à jour',
          });
        }
      } catch (e: any) {
        result.skipped++;
        result.errors.push({ row: r.row, reason: e.message || 'Erreur inconnue' });
      }
    }

    return result;
  }

  async findAll(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Customer[];
    total: number;
    page: number;
    pages: number;
    perPage: number;
  }> {
    const { search, page = 1, limit = 20 } = params || {};
    const base: any = { deletedAt: IsNull() };

    const where: any = search
      ? [
          { ...base, fullName: ILike(`%${search}%`) },
          { ...base, phone: ILike(`%${search}%`) },
          { ...base, phone2: ILike(`%${search}%`) },
        ]
      : base;

    const skip = (page - 1) * limit;

    const [data, total] = await this.customersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' }, // id = stable tie-breaker for pagination
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

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOne(id);
    const dto = this.blankToNull(updateCustomerDto as Record<string, any>);

    const newName = dto.fullName ?? customer.fullName;
    const newPhone = 'phone' in dto ? dto.phone : customer.phone;
    if (newName !== customer.fullName || (newPhone ?? null) !== (customer.phone ?? null)) {
      await this.checkDuplicate(newName, newPhone, id);
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
        { fullName: ILike(`%${query}%`), deletedAt: IsNull() },
        { phone: ILike(`%${query}%`), deletedAt: IsNull() },
        { phone2: ILike(`%${query}%`), deletedAt: IsNull() },
      ],
      take: 10,
    });
  }

  async getStats(): Promise<{ total: number }> {
    const total = await this.customersRepository.count({
      where: { deletedAt: IsNull() },
    });
    return { total };
  }
}