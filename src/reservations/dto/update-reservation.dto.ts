import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';
import { IsEnum, IsOptional, IsString, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '../entities/reservation.entity';

export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, ['carId', 'dailyRate'] as const),
) {
  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyRate?: number;


  

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  actualPickupDate?: string;
@ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerId?: string;
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  actualReturnDate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  pickupOdometer?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  returnOdometer?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pickupNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  returnNotes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cancelReason?: string;
}