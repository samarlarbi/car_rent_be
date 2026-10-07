import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationStatus } from './entities/reservation.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import { buildExcelBuffer } from '../common/excel/excel.util';
import { UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { parseExcelBuffer } from '../common/excel/excel.util';
import { CarsService } from '../cars/cars.service';
import { CustomersService } from '../customers/customers.service';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly carsService: CarsService,
    private readonly customersService: CustomersService,
  ) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import reservations from an Excel file' })
  async importReservations(@UploadedFile() file: { buffer: Buffer }, @Req() req) {
    if (!file) throw new BadRequestException('No file uploaded');

    const rows = await parseExcelBuffer(file.buffer);
    const result = { imported: 0, skipped: 0, errors: [] as { row: number; reason: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const plate = row['Plaque du Véhicule'];
        const phone = row['Téléphone Client'];
        if (!plate) throw new Error('Plaque du véhicule manquante');
        if (!phone) throw new Error('Téléphone client manquant');

        const [car] = await this.carsService.search(String(plate));
        if (!car) throw new Error(`Aucun véhicule trouvé avec la plaque "${plate}"`);

        const [customer] = await this.customersService.search(String(phone));
        if (!customer) throw new Error(`Aucun client trouvé avec le téléphone "${phone}"`);

        await this.reservationsService.create(
          {
            carId: car.id,
            customerId: customer.id,
            startDate: row['Date de Début'],
            endDate: row['Date de Fin'],
            status: row['Statut'] || undefined,
            notes: row['Notes'] || undefined,
          } as any,
          req.user.id,
        );
        result.imported++;
      } catch (e: any) {
        result.skipped++;
        result.errors.push({ row: i + 2, reason: e.message || 'Erreur inconnue' });
      }
    }

    return result;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new reservation' })
  @ApiResponse({ status: 201, description: 'Reservation created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dates' })
  @ApiResponse({ status: 409, description: 'Car not available for selected dates' })
  async create(@Body() createReservationDto: CreateReservationDto, @Req() req) {
    return this.reservationsService.create(createReservationDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reservations with filters' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ReservationStatus })
  @ApiQuery({ name: 'carId', required: false, type: String })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('status', new ParseEnumPipe(ReservationStatus, { optional: true })) status?: ReservationStatus,
    @Query('carId') carId?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.reservationsService.findAll({
      search,
      status,
      carId,
      customerId,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all reservations to Excel' })
  async exportReservations(@Res() res: Response) {
    const { data } = await this.reservationsService.findAll({ page: 1, limit: 1_000_000 });

    const rows = data.map((r: any) => ({
      carPlate: r.car?.plateNumber,
      customerName: [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(' '),
      customerPhone: r.customer?.phone,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      notes: r.notes,
    }));

    const buffer = await buildExcelBuffer(rows, [
      { header: 'Plaque du Véhicule', key: 'carPlate' },
      { header: 'Nom Client', key: 'customerName' },
      { header: 'Téléphone Client', key: 'customerPhone' },
      { header: 'Date de Début', key: 'startDate' },
      { header: 'Date de Fin', key: 'endDate' },
      { header: 'Statut', key: 'status' },
      { header: 'Notes', key: 'notes' },
    ]);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="reservations-export.xlsx"',
    });
    res.send(buffer);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get reservation statistics' })
  async getStats() {
    return this.reservationsService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search reservations' })
  @ApiQuery({ name: 'q', required: true, type: String })
  async search(@Query('q') query: string) {
    return this.reservationsService.search(query);
  }

  @Get('calendar/:carId')
  @ApiOperation({ summary: 'Get calendar events for a car' })
  @ApiParam({ name: 'carId', type: String })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  async getCalendarEvents(
    @Param('carId', ParseUUIDPipe) carId: string,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
  ) {
    return this.reservationsService.getCalendarEvents(
      carId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reservation by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Reservation found' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reservation' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Reservation updated successfully' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReservationDto: UpdateReservationDto,
    @Req() req,
  ) {
    return this.reservationsService.update(id, updateReservationDto, req.user.id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm a reservation' })
  @ApiParam({ name: 'id', type: String })
  async confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.reservationsService.confirmReservation(id, req.user.id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a rental (check-out)' })
  @ApiParam({ name: 'id', type: String })
  async startRental(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.startRental(id);
  }

@Post(':id/complete')
  @ApiOperation({ summary: 'Complete a rental (User confirms vehicle return)' })
  @ApiParam({ name: 'id', type: String })
  async completeRental(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('actualReturnDate') actualReturnDate?: string,
  ) {
    return this.reservationsService.completeRental(
      id, 
      actualReturnDate ? new Date(actualReturnDate) : undefined
    );
  }

  @Post(':id/extend')
  @ApiOperation({ summary: 'Extend a rental (User declines completion, selects new end date)' })
  @ApiParam({ name: 'id', type: String })
  async extendRental(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() extendDto: { newEndDate: string },
  ) {
    return this.reservationsService.extendRental(id, new Date(extendDto.newEndDate));
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiParam({ name: 'id', type: String })
  async cancelReservation(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return this.reservationsService.cancelReservation(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a reservation (soft delete)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Reservation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.remove(id);
  }
}