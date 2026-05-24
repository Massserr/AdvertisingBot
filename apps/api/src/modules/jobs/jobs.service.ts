import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { NOTIFICATION_QUEUE, ORDER_QUEUE } from "./jobs.constants";

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(ORDER_QUEUE) private readonly orderQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue
  ) {}

  scheduleOwnerTimeout(orderId: string, runAt: Date) {
    return this.orderQueue.add("owner-timeout", { orderId }, this.jobOptions(`owner-timeout:${orderId}`, runAt));
  }

  scheduleAutoPublication(orderId: string, runAt: Date) {
    return this.orderQueue.add("auto-publication", { orderId }, this.jobOptions(`auto-publication:${orderId}`, runAt));
  }

  scheduleAdvertiserAutoConfirmation(orderId: string, runAt: Date) {
    return this.orderQueue.add("advertiser-auto-confirmation", { orderId }, this.jobOptions(`advertiser-auto-confirmation:${orderId}`, runAt));
  }

  queueTelegramNotification(notificationId: string) {
    return this.notificationQueue.add("telegram-notification", { notificationId });
  }

  private jobOptions(jobId: string, runAt: Date) {
    return {
      jobId,
      delay: Math.max(0, runAt.getTime() - Date.now()),
      removeOnComplete: true,
      removeOnFail: 100
    };
  }
}
