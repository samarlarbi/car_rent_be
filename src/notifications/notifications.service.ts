import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../device-tokens/entities/device-token.entity';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
  ) {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  /**
   * Méthode appelée par vos Cron jobs pour notifier tout le staff actif
   */
  async sendToAllActiveStaff(title: string, body: string, data?: Record<string, string>) {
    return this.sendPushNotification(title, body, data);
  }

  async sendPushNotification(title: string, body: string, data?: Record<string, string>) {
    try {
      // Récupération de tous les tokens enregistrés (sans deletedAt si non géré par l'entité)
      const tokensRecords = await this.deviceTokenRepository.find();
const tokens = [...new Set(tokensRecords.map((t) => t.token))];
      if (tokens.length === 0) {
        this.logger.warn('Aucun token FCM trouvé pour envoyer la notification.');
        return;
      }

    const message: MulticastMessage = {
        tokens,
        // ❌ Remove the top-level 'notification' block so Android doesn't auto-show it
        data: {
          ...(data || {}),
          title: title, // Pass title inside data
          body: body,   // Pass body inside data
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
      };

      const response = await getMessaging().sendEachForMulticast(message);
      this.logger.log(`Notifications envoyées : ${response.successCount} réussies, ${response.failureCount} échecs.`);
    } catch (error) {
      this.logger.error('Erreur lors de l\'envoi de la notification FCM', error);
    }
  }
}