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

  @Column({ unique: true, nullable: true })
  phone: string;

  // --- technical columns (kept on purpose) ---
  // deletedAt: the code filters `deletedAt: IsNull()` and uses soft delete / restore.
  // createdAt / updatedAt: harmless bookkeeping (the customer detail screen shows them).
  @CreateDateColumn()
  createdAt: Date;
@Column({ nullable: true })
  cin: string;
  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Computed fields (not persisted)
  fullName?: string;
}