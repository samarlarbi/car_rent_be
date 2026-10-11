import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
} from 'typeorm';

@Entity('customers')
// Fields mirror the Excel columns: name, address, city, phone, phone 2
// Same name + same phone = duplicate (rows with a NULL phone are checked in the service)
@Unique(['fullName', 'phone'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  // Not unique alone: family members may share a phone
  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  phone2: string; // Secondary phone

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}