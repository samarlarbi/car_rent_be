import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCarDto {
  @ApiPropertyOptional({ example: 'Toyota', description: 'Car make (marque)' })
  @IsString()
  @IsOptional()
  make?: string;

  @ApiPropertyOptional({ example: 'Camry', description: 'Car model (modèle)' })
  @IsString()
  @IsOptional()
  model?: string;

  // Required now: the plate is the only thing that identifies a car.
  // (It used to be optional, which made the duplicate check in the service
  // match any car when the plate was missing.)
  @ApiProperty({ example: 'ABC-1234', description: 'License plate number' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;
}