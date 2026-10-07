// src/reservations/dto/extend-reservation.dto.ts
import { IsDateString, IsNotEmpty } from 'class-validator';

export class ExtendReservationDto {
  @IsDateString()
  @IsNotEmpty()
  newEndDate: string;
}