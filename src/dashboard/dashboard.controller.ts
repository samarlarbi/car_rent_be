import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/// "John Doe" from fullName (or firstName/lastName if present); null when there is no customer.
function customerNameOf(customer: any): string | null {
  if (!customer) return null;
  const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return customer.fullName?.trim() || full || null;
}

/// "Peugeot 208" from marque + codeEngin, otherwise the plate (matricule).
function carNameOf(car: any): string | null {
  if (!car) return null;
  const name = [car.marque, car.codeEngin].filter(Boolean).join(' ').trim();
  return name || car.matricule || null;
}

/// Shape every dashboard list item the same way so the Flutter app can
/// rely on the same keys everywhere.
function toDashboardItem(r: any) {
  return {
    id: r.id,
    carId: r.carId,
    customerId: r.customerId,
    customerName: customerNameOf(r.customer),
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    carName: carNameOf(r.car),
  };
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
    const reservations = await this.dashboardService.getUpcomingReservations(
      days ? parseInt(days.toString()) : 7,
    );
    return reservations.map(toDashboardItem);
  }

  @Get('today-pickups')
  @ApiOperation({ summary: 'Get today pickups' })
  async getTodayPickups() {
    const activity = await this.dashboardService.getTodayActivity();
    return activity.pickups.map(toDashboardItem);
  }

  @Get('ongoing')
  @ApiOperation({ summary: 'Get ongoing reservations' })
  async getOngoingReservations() {
    const reservations = await this.dashboardService.getOngoingReservations();
    return reservations.map(toDashboardItem);
  }

  @Get('today-returns')
  @ApiOperation({ summary: 'Get today returns' })
  async getTodayReturns() {
    const activity = await this.dashboardService.getTodayActivity();
    return activity.returns.map(toDashboardItem);
  }

  @Get('today-ends')
  @ApiOperation({ summary: 'Get reservations that end today' })
  async getTodayEnds() {
    const reservations = await this.dashboardService.getTodayEnds();
    return reservations.map(toDashboardItem);
  }

  @Get('available-cars')
  @ApiOperation({ summary: 'Get count of available cars' })
  async getAvailableCarsCount() {
    return { available: await this.dashboardService.getAvailableCarsCount() };
  }

  @Get('active-reservations')
  @ApiOperation({ summary: 'Get count of active reservations' })
  async getActiveReservationsCount() {
    return { active: await this.dashboardService.getActiveReservationsCount() };
  }
}