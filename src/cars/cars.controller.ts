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
  ParseEnumPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Multer } from 'multer';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { CarStatus, CarCategory } from './entities/car.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { buildExcelBuffer, parseExcelBuffer, toBool } from '../common/excel/excel.util';
@ApiTags('cars')
@Controller('cars')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new car' })
  @ApiResponse({ status: 201, description: 'Car created successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate plate number' })
  async create(@Body() createCarDto: CreateCarDto) {
    return this.carsService.create(createCarDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all cars with filters' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CarStatus })
  @ApiQuery({ name: 'category', required: false, enum: CarCategory })
  @ApiQuery({ name: 'minRate', required: false, type: Number })
  @ApiQuery({ name: 'maxRate', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('status', new ParseEnumPipe(CarStatus, { optional: true })) status?: CarStatus,
    @Query('category', new ParseEnumPipe(CarCategory, { optional: true })) category?: CarCategory,
    @Query('minRate') minRate?: number,
    @Query('maxRate') maxRate?: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.carsService.findAll({
      search,
      status,
      category,
      minRate,
      maxRate,
      page,
      limit,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all cars to Excel' })
  async exportCars(@Res() res: Response) {
    const { data } = await this.carsService.findAll({ page: 1, limit: 1_000_000 });

    const buffer = await buildExcelBuffer(data as any, [
      { header: 'Marque', key: 'make' },
      { header: 'Modèle', key: 'model' },
      { header: 'Année', key: 'year' },
      { header: 'Numéro de Plaque', key: 'plateNumber' },
      { header: 'Catégorie', key: 'category' },
      { header: 'Tarif Journalier', key: 'dailyRate' },
      { header: 'Couleur', key: 'color' },
      { header: 'Statut', key: 'status' },
      { header: 'Places', key: 'seats' },
      { header: 'GPS', key: 'hasGPS' },
      { header: 'Bluetooth', key: 'hasBluetooth' },
      { header: 'Caméra de Recul', key: 'hasBackupCamera' },
      { header: 'Toit Ouvrant', key: 'hasSunroof' },
      { header: 'Sièges en Cuir', key: 'hasLeatherSeats' },
      { header: 'Description', key: 'description' },
    ]);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="vehicules-export.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import cars from an Excel file' })
  async importCars(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    const rows = await parseExcelBuffer(file.buffer);
    const result = { imported: 0, skipped: 0, errors: [] as { row: number; reason: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await this.carsService.create({
          make: row['Marque'],
          model: row['Modèle'],
          year: row['Année'] ? Number(row['Année']) : undefined,
          plateNumber: row['Numéro de Plaque'],
          category: row['Catégorie'],
          dailyRate: row['Tarif Journalier'] ? Number(row['Tarif Journalier']) : undefined,
          color: row['Couleur'] || undefined,
          seats: row['Places'] ? Number(row['Places']) : undefined,
          hasGPS: toBool(row['GPS']),
          hasBluetooth: toBool(row['Bluetooth']),
          hasBackupCamera: toBool(row['Caméra de Recul']),
          hasSunroof: toBool(row['Toit Ouvrant']),
          hasLeatherSeats: toBool(row['Sièges en Cuir']),
          description: row['Description'] || undefined,
        } as any);
        result.imported++;
      } catch (e: any) {
        result.skipped++;
        result.errors.push({ row: i + 2, reason: e.message || 'Erreur inconnue' });
      }
    }

    return result;
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available cars for date range' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiQuery({ name: 'category', required: false, type: String })
  async getAvailableCars(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('category') category?: string,
  ) {
    return this.carsService.getAvailableCars(
      new Date(startDate),
      new Date(endDate),
      category,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get car fleet statistics' })
  async getStats() {
    return this.carsService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search cars' })
  @ApiQuery({ name: 'q', required: true, type: String })
  async search(@Query('q') query: string) {
    return this.carsService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get car by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Car found' })
  @ApiResponse({ status: 404, description: 'Car not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.carsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a car' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Car updated successfully' })
  @ApiResponse({ status: 404, description: 'Car not found' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCarDto: UpdateCarDto) {
    return this.carsService.update(id, updateCarDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update car status' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'status', enum: CarStatus })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status', new ParseEnumPipe(CarStatus)) status: CarStatus,
  ) {
    return this.carsService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a car (soft delete)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Car deleted successfully' })
  @ApiResponse({ status: 404, description: 'Car not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.carsService.remove(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a deleted car' })
  @ApiParam({ name: 'id', type: String })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.carsService.restore(id);
  }
}