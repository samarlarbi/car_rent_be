import {
  IsString,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  fullName: string; // 👈 Changed from firstName to fullName

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number' })
   @IsOptional()
  @IsString()
@Matches(/^(\+?[\d\s\-()]{7,20})?$/, {message: 'Le format du numéro de téléphone est invalide',  })
  phone?: string;

  @ApiPropertyOptional({ example: '12345678', description: 'National Identity Card (CIN)' })
  @IsString()
  @IsOptional()
  cin?: string;
}