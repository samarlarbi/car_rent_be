import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column({ nullable: true })
  phone2: string; // 👈 Secondary phone

  @Column({ nullable: true })
  address: string; // 👈 Address

  @Column({ nullable: true })
  city: string; // 👈 City

  @Column({ unique: true, nullable: true })
  cin: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}