import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
      revenueToday: stats.revenue.today,
      revenueMonth: stats.revenue.thisMonth,
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
      customerName: r.customer?.fullName || `${r.customer?.firstName} ${r.customer?.lastName}`.trim(),
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
      carName: r.car?.make ? `${r.car.make} ${r.car.model}` : null,
    }));
  }

  @Get('today-pickups')
  @ApiOperation({ summary: 'Get today pickups' })
  async getTodayPickups() {
    const activity = await this.dashboardService.getTodayActivity();
    return activity.pickups.map(p => ({
      id: p.id,
      reservationNumber: p.reservationNumber,
      customerName: p.customer?.fullName || `${p.customer?.firstName} ${p.customer?.lastName}`.trim(),
      startDate: p.startDate,
      carName: p.car?.make ? `${p.car.make} ${p.car.model}` : null,
    }));
  }

  @Get('today-returns')
  @ApiOperation({ summary: 'Get today returns' })
  async getTodayReturns() {
    const activity = await this.dashboardService.getTodayActivity();
    return activity.returns.map(r => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      customerName: r.customer?.fullName || `${r.customer?.firstName} ${r.customer?.lastName}`.trim(),
      endDate: r.endDate,
      carName: r.car?.make ? `${r.car.make} ${r.car.model}` : null,
    }));
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
