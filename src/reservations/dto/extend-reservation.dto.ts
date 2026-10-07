// src/reservations/dto/extend-reservation.dto.ts
import { IsDateString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExtendReservationDto {
  @IsDateString()
  @IsNotEmpty()
  newEndDate: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  newStartDate?: string;
}