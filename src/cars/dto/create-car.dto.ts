import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCarDto {
  @ApiPropertyOptional({ example: '1', description: 'Code Engin' })
  @IsString()
  @IsOptional()
  codeEngin?: string;

  @ApiPropertyOptional({ example: 'HYUNDAI', description: 'Marque' })
  @IsString()
  @IsOptional()
  marque?: string;

  @ApiProperty({ example: '4 TU 219', description: 'Matricule' })
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @ApiPropertyOptional({ example: 'hchem zarsis', description: 'Adresse' })
  @IsString()
  @IsOptional()
  adresse?: string;

  @ApiPropertyOptional({ example: 'MALA851CALM067748', description: 'N° Chassis' })
  @IsString()
  @IsOptional()
  numeroChassis?: string;

  @ApiPropertyOptional({ example: '2020-11-09', description: '1iére Date Circulation' })
  @IsString()
  @IsOptional()
  premiereDateCirculation?: string;

  @ApiPropertyOptional({ example: '2023-01-01', description: 'Date Assurance' })
  @IsString()
  @IsOptional()
  dateAssurance?: string;

  @ApiPropertyOptional({ example: '2023-04-20', description: 'Fin Assurance' })
  @IsString()
  @IsOptional()
  finAssurance?: string;

  @ApiPropertyOptional({ example: '2023-01-01', description: 'Date Taxe' })
  @IsString()
  @IsOptional()
  dateTaxe?: string;

  @ApiPropertyOptional({ example: '2023-12-31', description: 'Fin Taxe' })
  @IsString()
  @IsOptional()
  finTaxe?: string;

  @ApiPropertyOptional({ example: '2015-02-08', description: 'Date debut visite technique' })
  @IsString()
  @IsOptional()
  dateDebutVisiteTechnique?: string;

  @ApiPropertyOptional({ example: '2015-08-06', description: 'Date fin visite technique' })
  @IsString()
  @IsOptional()
  dateFinVisiteTechnique?: string;

  @ApiPropertyOptional({ example: 'R 520', description: 'Ref filtre air' })
  @IsString()
  @IsOptional()
  refFiltreAir?: string;

  @ApiPropertyOptional({ example: 'FT 651', description: 'Ref filtre Huile' })
  @IsString()
  @IsOptional()
  refFiltreHuile?: string;

  @ApiPropertyOptional({ example: '2023-04-27', description: 'Validité carte circulation' })
  @IsString()
  @IsOptional()
  validiteCarteCirculation?: string;
}