import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// NOTE: I haven't seen your original DTO. Compare with it and keep any
// extra fields/decorators you already had.
export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cin?: string;
}

// ---- update-customer.dto.ts ----
// import { PartialType } from '@nestjs/swagger';
// import { CreateCustomerDto } from './create-customer.dto';
// export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}