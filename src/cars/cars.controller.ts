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
} from '@nestjs/common';
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

  @Get('available')
  @ApiOperation({ summary: 'Get available cars for date range' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  async getAvailableCars(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
  ) {
    return this.carsService.getAvailableCars(new Date(startDate), new Date(endDate));
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