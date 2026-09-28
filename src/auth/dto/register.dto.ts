import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: ['en', 'fr', 'ar'] })
  @IsOptional()
  @IsString()
  language?: string;

  // What the user is asking to be, at signup. Purely a request -- an admin
  // still has to approve the account, and can grant a different role than
  // requested if they choose to.
  @ApiPropertyOptional({ enum: ['admin', 'coworker'], default: 'coworker' })
  @IsOptional()
  @IsIn(['admin', 'coworker'])
  requestedRole?: 'admin' | 'coworker';
}