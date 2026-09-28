import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';

@Injectable()
export class DeviceTokensService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly repo: Repository<DeviceToken>,
  ) {}

  /**
   * Registers or refreshes a device's push token for a user. Upserts on the
   * unique `token` column so re-logging in on the same device never creates
   * a duplicate row, and re-assigns userId in case the device was
   * previously used by a different account (shared/handed-down phone).
   */
  async register(userId: string, token: string, platform: 'android' | 'ios'): Promise<void> {
    const existing = await this.repo.findOne({ where: { token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(this.repo.create({ userId, token, platform }));
  }

  async getTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { userId } });
    return rows.map((r) => r.token);
  }

  async getAllActiveStaffTokens(): Promise<string[]> {
    // Joins through the user relation to only push to active accounts;
    // isActive is already a column on User.
    const rows = await this.repo
      .createQueryBuilder('dt')
      .innerJoin('dt.user', 'user')
      .where('user.isActive = true')
      .getMany();
    return rows.map((r) => r.token);
  }

  /** Called by NotificationsService when FCM reports a token as dead. */
  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.repo.createQueryBuilder().delete().where('token IN (:...tokens)', { tokens }).execute();
  }
}