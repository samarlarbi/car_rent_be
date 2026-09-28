import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Car } from '../../cars/entities/car.entity';
import { Customer } from '../../customers/entities/customer.entity';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reservationNumber: string;

  @ManyToOne(() => Car, { eager: true })
  @JoinColumn({ name: 'carId' })
  car: Car;

  @Column()
  carId: string;

  @ManyToOne(() => Customer, { eager: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ nullable: true })
  customerId: string;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  pickupLocation: string;

  @Column({ nullable: true })
  dropoffLocation: string;

  @Column({ nullable: true })
  actualPickupDate: Date;

  @Column({ nullable: true })
  actualReturnDate: Date;

  @Column({ nullable: true })
  pickupOdometer: number;

  @Column({ nullable: true })
  returnOdometer: number;

  @Column({ type: 'text', nullable: true })
  pickupNotes: string;

  @Column({ type: 'text', nullable: true })
  returnNotes: string;

  @Column({ nullable: true })
  confirmedBy: string;

  @Column({ nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  cancelledBy: string;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancelReason: string;

  @Column({ nullable: true })
  completedBy: string;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Computed field
  totalDays?: number;
}