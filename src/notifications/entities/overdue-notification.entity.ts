import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * One row per reservation that has already triggered an "overdue return"
 * push. Kept as its own table rather than a column on Reservation so the
 * overdue-tracking concern stays fully decoupled from the reservation
 * schema. The cron job checks for the absence of a row before sending, and
 * inserts one right after a successful send.
 */
@Entity('overdue_notifications')
export class OverdueNotification {
  @PrimaryColumn('uuid')
  reservationId: string;

  @CreateDateColumn()
  notifiedAt: Date;
}