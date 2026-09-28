import { PartialType } from '@nestjs/swagger';
import { CreateCarDto } from './create-car.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { CarStatus } from '../entities/car.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCarDto extends PartialType(CreateCarDto) {
  @ApiPropertyOptional({ enum: CarStatus, example: CarStatus.AVAILABLE })
  @IsEnum(CarStatus)
  @IsOptional()
  status?: CarStatus;
}