import { Reservation } from '../../reservations/entities/reservation.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ValueTransformer,
} from 'typeorm';

export enum CarStatus {
  AVAILABLE = 'disponible',
  RESERVED = 'réservé',
  IN_CIRCULATION = 'en_circulation',
  MAINTENANCE = 'en_maintenance',
}

// Transformateur pour convertir n'importe quelle chaîne/date reçue en un objet Date valide pour PostgreSQL
const dateTransformer: ValueTransformer = {
  to(value: any): any {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  },
  from(value: any): any {
    return value;
  },
};

@Entity('cars')
export class Car {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  codeEngin: string;

  @Column({ nullable: true })
  marque: string;

  @Column({ unique: true, nullable: true })
  matricule: string;

  @Column({ nullable: true })
  adresse: string;

  @Column({ nullable: true })
  numeroChassis: string;

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  premiereDateCirculation: Date; // Changé de string à Date

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dateAssurance: Date; // Changé de string à Date

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  finAssurance: Date; // Changé de string à Date

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dateTaxe: Date; // Changé de string à Date

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  finTaxe: Date; // Changé de string à Date

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dateDebutVisiteTechnique: Date; // Changé de string à Date

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dateFinVisiteTechnique: Date; // Changé de string à Date

  @Column({ nullable: true })
  refFiltreAir: string;

  @Column({ nullable: true })
  refFiltreHuile: string;

  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  validiteCarteCirculation: Date; // Changé de string à Date

  @Column({
    type: 'enum',
    enum: CarStatus,
    default: CarStatus.AVAILABLE,
  })
  status: CarStatus;

  @OneToMany(() => Reservation, (reservation) => reservation.car)
  reservations: Reservation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}