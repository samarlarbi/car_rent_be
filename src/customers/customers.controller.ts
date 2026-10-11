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
import * as ExcelJS from 'exceljs';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { buildExcelBuffer } from '../common/excel/excel.util';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate phone' })
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers with filters' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.customersService.findAll({ search, page, limit });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all customers to Excel' })
  async exportCustomers(@Res() res: Response) {
    const { data } = await this.customersService.findAll({
      page: 1,
      limit: 1_000_000,
    });

    const buffer = await buildExcelBuffer(data as any, [
      { header: 'Nom et Prénom', key: 'fullName' },
      { header: 'Adresse', key: 'address' },
      { header: 'Ville', key: 'city' },
      { header: 'Téléphone', key: 'phone' },
      { header: 'Téléphone 2', key: 'phone2' },
      { header: 'CIN', key: 'cin' },
    ]);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="clients-export.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import customers from an Excel file' })
  async importCustomers(@UploadedFile() file: { buffer: Buffer }) {
    if (!file) throw new BadRequestException('No file uploaded');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Empty workbook');

    const text = (row: ExcelJS.Row, col: number) =>
      String(row.getCell(col).text ?? '').trim();

    // Digits only; treat "0", "00000000", "" as no phone
    const cleanPhone = (v: string): string | undefined => {
      const digits = v.replace(/\D/g, '');
      return digits && !/^0+$/.test(digits) ? digits : undefined;
    };
    // Empty cells and "********" placeholders are treated as missing
    const placeholder = (v: string) => !v || v.includes('*');

    // Columns: A=full name, B=address, C=city, D=phone, E=phone 2
    // Skip row 1 if it looks like a header (no digits in the phone column)
    const firstRow = ws.getRow(1);
    const startRow = /\d/.test(text(firstRow, 4)) ? 1 : 2;

    const result = {
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; reason: string }[],
    };

    for (let r = startRow; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rawName = text(row, 1);
      const address = text(row, 2);
      const city = text(row, 3);
      const phone = cleanPhone(text(row, 4));
      const phone2 = cleanPhone(text(row, 5));

      // only skip rows that are completely empty
      if (!rawName && !address && !city && !text(row, 4) && !text(row, 5)) {
        continue;
      }

      try {
        await this.customersService.create(
          {
            fullName: rawName || phone || 'Sans nom',
            phone,
            phone2,
            address: placeholder(address) ? undefined : address,
            city: placeholder(city) ? undefined : city,
          } as any,
          { skipSimilarCheck: true },
        );
        result.imported++;
      } catch (e: any) {
        result.skipped++;
        result.errors.push({ row: r, reason: e.message || 'Erreur inconnue' });
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