import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseBoolPipe,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { buildExcelBuffer, parseExcelBuffer, toBool } from '../common/excel/excel.util';
@ApiTags('customers')
@Controller('customers')

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate email or phone' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers with filters' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isBlacklisted', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('isBlacklisted', new ParseBoolPipe({ optional: true })) isBlacklisted?: boolean,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.customersService.findAll({
      search,
      isBlacklisted,
      page,
      limit,
    });
  }
@Get('export')
@ApiOperation({ summary: 'Export all customers to Excel' })
async exportCustomers(@Res() res: Response) {
  const { data } = await this.customersService.findAll({ page: 1, limit: 1_000_000 });

  const buffer = await buildExcelBuffer(data as any, [
    { header: 'First Name', key: 'firstName' },
    { header: 'Last Name', key: 'lastName' },
    { header: 'Email', key: 'email' },
    { header: 'Phone', key: 'phone' },
    { header: 'Address', key: 'address' },
    { header: 'City', key: 'city' },
    { header: 'State', key: 'state' },
    { header: 'Country', key: 'country' },
    { header: 'Postal Code', key: 'postalCode' },
    { header: 'ID Number', key: 'idNumber' },
    { header: 'ID Type', key: 'idType' },
    { header: 'License Number', key: 'drivingLicenseNumber' },
    { header: 'License Expiry', key: 'drivingLicenseExpiry' },
    { header: 'License Country', key: 'drivingLicenseCountry' },
    { header: 'Notes', key: 'notes' },
    { header: 'Blacklisted', key: 'isBlacklisted' },
    { header: 'Total Rentals', key: 'totalRentals' },
  ]);

  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="customers-export.xlsx"',
  });
  res.send(buffer);
}

@Post('import')
@UseInterceptors(FileInterceptor('file'))
@ApiOperation({ summary: 'Import customers from an Excel file' })
async importCustomers(@UploadedFile() file: { buffer: Buffer }) {
  if (!file) throw new BadRequestException('No file uploaded');

  const rows = await parseExcelBuffer(file.buffer);
  const result = { imported: 0, skipped: 0, errors: [] as { row: number; reason: string }[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await this.customersService.create({
        firstName: row['First Name'],
        lastName: row['Last Name'] || undefined,
        email: row['Email'] || undefined,
        phone: row['Phone'] || undefined,
        address: row['Address'] || undefined,
        city: row['City'] || undefined,
        state: row['State'] || undefined,
        country: row['Country'] || undefined,
        postalCode: row['Postal Code'] || undefined,
        idNumber: row['ID Number'] || undefined,
        idType: row['ID Type'] || undefined,
        drivingLicenseNumber: row['License Number'] || undefined,
        drivingLicenseExpiry: row['License Expiry'] ? String(row['License Expiry']) : undefined,
        drivingLicenseCountry: row['License Country'] || undefined,
        notes: row['Notes'] || undefined,
      } as any);
      result.imported++;
    } catch (e: any) {
      result.skipped++;
      result.errors.push({ row: i + 2, reason: e.message || 'Unknown error' });
    }
  }

  return result;
}
  @Get('stats')
  @ApiOperation({ summary: 'Get customer statistics' })
  async getStats() {
    return this.customersService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search customers' })
  @ApiQuery({ name: 'q', required: true, type: String })
  async search(@Query('q') query: string) {
    return this.customersService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer (soft delete)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted customer' })
  @ApiParam({ name: 'id', type: String })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.restore(id);
  }
}




