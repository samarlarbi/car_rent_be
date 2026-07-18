import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ unique: true ,nullable: true })
  email: string;

  @Column({ unique: true ,nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ nullable: true })
  idNumber: string;

  @Column({ nullable: true })
  idType: string;

  @Column({ nullable: true })
  drivingLicenseNumber: string;

  @Column({ nullable: true })
  drivingLicenseExpiry: Date;

  @Column({ nullable: true })
  drivingLicenseCountry: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  isBlacklisted: boolean;

  @Column({ nullable: true })
  blacklistReason: string;

  @Column({ nullable: true })
  blacklistedAt: Date;

  @Column({ default: 0 })
  totalRentals: number;

  @Column({ default: 0 })
  totalSpent: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Computed fields (not persisted)
  fullName?: string;
}