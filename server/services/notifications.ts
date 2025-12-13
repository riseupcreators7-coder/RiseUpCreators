import { AnalyticsService } from "./analytics";
import { storage } from "../storage";

/**
 * Notification Service - CLEAN & ESSENTIAL
 * Only the most critical notifications, no bloat
 */
export class NotificationService {

  // Critical business notifications
  static async notifyPlanUpgrade(userId: string, planType: string, amount: number) {
    try {
      // Log as analytics event
      await AnalyticsService.trackEvent("system", "plan_upgraded", "subscription", {
        userId,
        planType,
        amount,
        currency: "INR"
      });

      

      // In production: Queue email/SMS/WebSocket notification here
      return {
        success: true,
        message: `Plan upgrade notification logged for ${planType}`
      };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }

  static async notifyPaymentSuccess(userId: string, amount: number, orderId: string) {
    try {
      await AnalyticsService.trackPurchase(userId, orderId, amount, "subscription");

      

      return { success: true };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }

  static async notifyRefundProcessed(userId: string, amount: number, orderId: string) {
    try {
      await AnalyticsService.trackEvent("system", "refund_processed", "payment", {
        userId,
        amount,
        orderId,
        currency: "INR"
      });

      

      return { success: true };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }

  // Content-related notifications
  static async notifySongUploaded(artistId: string, songTitle: string) {
    try {
      await AnalyticsService.trackEvent(artistId, "song_uploaded", "creator", {
        songTitle
      });

      

      return { success: true };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }

  static async notifyNewFollower(artistId: string, followerId: string) {
    try {
      await AnalyticsService.trackEvent(followerId, "follow", "social", {
        artistId
      });

      

      return { success: true };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }

  // Critical admin notifications
  static async notifyAdminAction(adminId: string, action: string, details: any) {
    try {
      await AnalyticsService.trackEvent(adminId, action, "admin_action", details);
      

      return { success: true };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }

  // Batch notifications for efficiency
  static async notifyBatchUsers(actions: Array<{
    userId: string;
    action: string;
    context: string;
    metadata: any;
  }>) {
    try {
      const promises = actions.map(tracking =>
        AnalyticsService.trackEvent(
          tracking.userId,
          tracking.action,
          tracking.context,
          tracking.metadata
        )
      );

      await Promise.allSettled(promises);

      

      return { success: true, count: actions.length };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }



  // Plan limit notifications
  static async notifyLimitApproaching(userId: string, limitType: string, current: number, limit: number) {
    try {
      await AnalyticsService.trackEvent(userId, "limit_warning", "subscription", {
        limitType,
        current,
        limit,
        percentage: Math.round((current / limit) * 100)
      });

      

      return { success: true };
    } catch (error) {
      
      return { success: false, error: error };
    }
  }
}

/**
 * Notification Queue - Prevents notification spam
 * Batches similar notifications and throttles them
 */
export class NotificationQueue {
  private static queue: Map<string, any[]> = new Map();

  static async add(eventType: string, data: any) {
    if (!this.queue.has(eventType)) {
      this.queue.set(eventType, []);
    }

    this.queue.get(eventType)!.push(data);

    // Process after a small delay to batch similar events
    setTimeout(() => this.process(eventType), 1000);
  }

  private static async process(eventType: string) {
    const events = this.queue.get(eventType);
    if (!events || events.length === 0) return;

    // Clear the queue
    this.queue.set(eventType, []);

    // Process batched events
    try {
      switch (eventType) {
        case "follow":
          if (events.length === 1) {
            await NotificationService.notifyNewFollower(
              events[0].artistId,
              events[0].followerId
            );
          } else {
            
            // Process all follows
            const batchActions = events.map(event => ({
              userId: event.followerId,
              action: "follow",
              context: "social",
              metadata: { artistId: event.artistId }
            }));
            await NotificationService.notifyBatchUsers(batchActions);
          }
          break;

        default:
          
          break;
      }
    } catch (error) {
      
    }
  }
}

export default NotificationService;

