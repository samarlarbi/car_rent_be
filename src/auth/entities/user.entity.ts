import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: '' })
  firstName: string;

  @Column({ default: '' })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'en', enum: ['en', 'fr', 'ar'] })
  language: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isApproved: boolean;

  // The actual, currently-granted privilege level. All existing guards
  // (e.g. req.user?.isSuperAdmin) keep working exactly as before -- this
  // column is untouched by the new role-request feature until an admin
  // actually approves/promotes the account.
  @Column({ default: false })
  isSuperAdmin: boolean;

  // What the user asked for at registration ('admin' or 'coworker'). Purely
  // informational until approval: it does not grant any privilege by
  // itself, it just tells the approving admin what was requested so they
  // can decide whether to grant it.
  @Column({ default: 'coworker' })
  requestedRole: 'admin' | 'coworker';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastLogin: Date;

  @Column({ nullable: true })
  refreshToken: string;
}