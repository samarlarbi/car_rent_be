import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

// reminder-log.entity.ts
@Entity('reminder_logs')
export class ReminderLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reservationId: string;

  @Column()
  slot: string; // 'MORNING' or 'EVENING'

  @Column({ type: 'date' })
  reminderDate: string; // 'YYYY-MM-DD'

  @CreateDateColumn()
  createdAt: Date;
}