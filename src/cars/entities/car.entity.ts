import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum CarStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
}

@Entity('cars')
export class Car {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Same definitions as the original entity, so the existing columns and data are untouched.
  @Column({ nullable: true })
  make: string;

  @Column({ nullable: true })
  model: string;

  @Column({ unique: true, nullable: true })
  plateNumber: string;

  @Column({
    type: 'enum',
    enum: CarStatus,
    default: CarStatus.AVAILABLE,
  })
  status: CarStatus;

  // --- technical columns (kept on purpose) ---
  // deletedAt: the code filters `deletedAt: IsNull()` and uses soft delete / restore.
  // createdAt / updatedAt: harmless bookkeeping, often used for ordering.
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}