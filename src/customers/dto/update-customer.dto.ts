import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsBoolean, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['email', 'phone'] as const),
) {
  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isBlacklisted?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  blacklistReason?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  blacklistedAt?: string;

  @ApiPropertyOptional({ example: 'john.doe@email.com' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  phone?: string;
}