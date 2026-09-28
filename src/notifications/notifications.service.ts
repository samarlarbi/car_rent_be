import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { DeviceTokensService } from '../device-tokens/device-tokens.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private app: App | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly deviceTokensService: DeviceTokensService,
  ) {}

  onModuleInit() {
    // Read from env vars rather than a JSON file path: Vercel's filesystem
    // is read-only/ephemeral in production, so the service account key
    // lives in project environment variables instead.
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    // The .env value keeps literal "\n" sequences (can't store real
    // newlines in a single-line env var); convert them back here.
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials missing (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY) — push notifications disabled.',
      );
      return;
    }

    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    this.logger.log('Firebase Admin initialized');
  }

  private async send(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!this.app || tokens.length === 0) return;

    const response = await getMessaging(this.app).sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    // Prune tokens FCM reports as dead (uninstalled app, expired token,
    // etc.) so the token table doesn't accumulate junk and future sends
    // don't keep failing against them.
    const deadTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          deadTokens.push(tokens[i]);
        } else {
          this.logger.warn(`Push send failed for token ${tokens[i]}: ${r.error?.message}`);
        }
      }
    });
    if (deadTokens.length > 0) {
      await this.deviceTokensService.removeTokens(deadTokens);
    }

    this.logger.log(
      `Push sent: ${response.successCount} succeeded, ${response.failureCount} failed`,
    );
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    const tokens = await this.deviceTokensService.getTokensForUser(userId);
    await this.send(tokens, title, body, data);
  }

  async sendToAllActiveStaff(title: string, body: string, data?: Record<string, string>) {
    const tokens = await this.deviceTokensService.getAllActiveStaffTokens();
    await this.send(tokens, title, body, data);
  }
}