import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsDateString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()

  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
    @IsOptional()

  lastName: string;

  @ApiProperty({ example: 'john.doe@email.com', description: 'Email address' })
  @IsEmail()
    @IsOptional()

  email: string;

  @ApiProperty({ example: '+1234567890', description: 'Phone number' })
  @IsString()
    @IsOptional()

  @Matches(/^\+?[\d\s\-()]{7,20}$/, {
    message: 'Invalid phone number format',
  })
  phone: string;

  @ApiPropertyOptional({ example: '123 Main Street' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'PASSPORT123456' })
  @IsString()
  @IsOptional()
  idNumber?: string;

  @ApiPropertyOptional({ example: 'passport' })
  @IsString()
  @IsOptional()
  idType?: string;

  @ApiPropertyOptional({ example: 'DL123456789' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  drivingLicenseExpiry?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsString()
  @IsOptional()
  drivingLicenseCountry?: string;

  @ApiPropertyOptional({ example: 'Preferred customer, always returns cars clean' })
  @IsString()
  @IsOptional()
  notes?: string;
}