import {
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ description: 'Car ID' })
  @IsUUID()
  carId: string;

  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Rental start date', example: '2024-01-15T10:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Rental end date', example: '2024-01-20T10:00:00Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Daily rate', example: 50.0 })
  @IsNumber()
  @Min(0)
  dailyRate: number;

  @ApiPropertyOptional({ description: 'Discount amount', example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @ApiPropertyOptional({ description: 'Deposit amount', example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @ApiPropertyOptional({ description: 'Pickup location' })
  @IsString()
  @IsOptional()
  pickupLocation?: string;

  @ApiPropertyOptional({ description: 'Dropoff location' })
  @IsString()
  @IsOptional()
  dropoffLocation?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}