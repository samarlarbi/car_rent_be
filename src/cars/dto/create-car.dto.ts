import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsInt,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CarCategory } from '../entities/car.entity';

export class CreateCarDto {
  @ApiProperty({ example: 'Toyota', description: 'Car make' })
  @IsString()
      @IsOptional()

  make: string;

  @ApiProperty({ example: 'Camry', description: 'Car model' })
  @IsString()
      @IsOptional()

  model: string;

  @ApiProperty({ example: 2024, description: 'Manufacturing year' })
  @IsInt()
      @IsOptional()

  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 'ABC-1234', description: 'License plate number' })
  @IsString()
    @IsOptional()

 
  plateNumber: string;

  @ApiProperty({ enum: CarCategory, example: CarCategory.SEDAN })
  @IsEnum(CarCategory)
    @IsOptional()

  category: CarCategory;

  @ApiProperty({ example: 50.00, description: 'Daily rental rate' })
  @IsNumber()
    @IsOptional()
  @Min(0)
  dailyRate: number;

  @ApiPropertyOptional({ example: 'Silver' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: '1HGBH41JXMN109186' })
  @IsString()
  @IsOptional()
  vin?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  mileage?: number;

  @ApiPropertyOptional({ type: [String], example: ['url1', 'url2'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @ApiPropertyOptional({ example: 'Well-maintained sedan with great fuel economy' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsNumber()
  @Min(1)
  @Max(9)
  @IsOptional()
  seats?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasGPS?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasBluetooth?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasBackupCamera?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasSunroof?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  hasLeatherSeats?: boolean;
}