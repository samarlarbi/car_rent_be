import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/// "John Doe", or just "John" when there is no last name; null when there is no customer.
function customerNameOf(customer: any): string | null {
  if (!customer) return null;
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return full || customer.fullName || null;
}

/// "Toyota Camry" when make/model are known, otherwise the plate number.
function carNameOf(car: any): string | null {
  if (!car) return null;
  const name = [car.make, car.model].filter(Boolean).join(' ').trim();
  return name || car.plateNumber || null;
}

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    const stats = await this.dashboardService.getDashboardStats();
    // Flatten the structure for frontend compatibility
    return {
      availableCars: stats.cars.available,
      activeReservations: stats.reservations.ongoing + stats.reservations.confirmed,
      todayPickups: stats.reservations.todayPickups,
      todayReturns: stats.reservations.todayReturns,
      totalCars: stats.cars.total,
      totalCustomers: stats.customers.total,
      totalReservations: stats.reservations.total,
      upcomingReservations: stats.reservations.upcomingPickups,
    };
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming reservations' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getUpcomingReservations(@Query('days') days?: number) {
    const reservations = await this.dashboardService.getUpcomingReservations(days ? parseInt(days.toString()) : 7);
    // Format for frontend
    return reservations.map(r => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      customerName: customerNameOf(r.customer),
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      carName: carNameOf(r.car),
    }));
  }

  @Get('today-pickups')
  @ApiOperation({ summary: 'Get today pickups' })
  async getTodayPickups() {
    const activity = await this.dashboardService.getTodayActivity();
    return activity.pickups.map(p => ({
      id: p.id,
      reservationNumber: p.reservationNumber,
      customerName: customerNameOf(p.customer),
      startDate: p.startDate,
      carName: carNameOf(p.car),
    }));
  }
@Get('ongoing')
  @ApiOperation({ summary: 'Get ongoing reservations' })
  async getOngoingReservations() {
    const reservations = await this.dashboardService.getOngoingReservations();
    return reservations.map(r => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      customerName: customerNameOf(r.customer),
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      carName: carNameOf(r.car),
    }));
  }
  @Get('today-returns')
  @ApiOperation({ summary: 'Get today returns' })
  async getTodayReturns() {
    const activity = await this.dashboardService.getTodayActivity();
    return activity.returns.map(r => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      customerName: customerNameOf(r.customer),
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      carName: carNameOf(r.car),
    }));
  }

  @Get('available-cars')
  @ApiOperation({ summary: 'Get count of available cars' })
  async getAvailableCarsCount() {
    return { available: await this.dashboardService.getAvailableCarsCount() };
  }
@Get('today-ends')
@ApiOperation({ summary: 'Get reservations that end today' })
async getTodayEnds() {
  const reservations = await this.dashboardService.getTodayEnds();
  return reservations.map(r => ({
    id: r.id,
    reservationNumber: r.reservationNumber,
    customerName: customerNameOf(r.customer),
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    carName: carNameOf(r.car),
  }));
}
  @Get('active-reservations')
  @ApiOperation({ summary: 'Get count of active reservations' })
  async getActiveReservationsCount() {
    return { active: await this.dashboardService.getActiveReservationsCount() };
  }
}