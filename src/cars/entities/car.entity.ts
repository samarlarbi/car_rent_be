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
  RENTED = 'rented',
  MAINTENANCE = 'maintenance',
}

export enum CarCategory {
  ECONOMY = 'economy',
  COMPACT = 'compact',
  SEDAN = 'sedan',
  SUV = 'suv',
  LUXURY = 'luxury',
  VAN = 'van',
  TRUCK = 'truck',
  SPORTS = 'sports',
}

@Entity('cars')
export class Car {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  make: string;

  @Column()
  model: string;

  @Column()
  year: number;

  @Column({ unique: true })
  plateNumber: string;

  @Column({
    type: 'enum',
    enum: CarCategory,
    default: CarCategory.SEDAN,
  })
  category: CarCategory;

  @Column('decimal', { precision: 10, scale: 2 })
  dailyRate: number;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  vin: string;

  @Column({ nullable: true })
  mileage: number;

  @Column({ type: 'text', array: true, nullable: true })
  photos: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: CarStatus,
    default: CarStatus.AVAILABLE,
  })
  status: CarStatus;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0, nullable: true })
  seats: number;

  @Column({ default: false })
  hasGPS: boolean;

  @Column({ default: false })
  hasBluetooth: boolean;

  @Column({ default: false })
  hasBackupCamera: boolean;

  @Column({ default: false })
  hasSunroof: boolean;

  @Column({ default: false })
  hasLeatherSeats: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}