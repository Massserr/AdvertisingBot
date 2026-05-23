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
    return this.orderQueue.add("owner-timeout", { orderId }, { delay: Math.max(0, runAt.getTime() - Date.now()) });
  }

  scheduleAutoPublication(orderId: string, runAt: Date) {
    return this.orderQueue.add("auto-publication", { orderId }, { delay: Math.max(0, runAt.getTime() - Date.now()) });
  }

  scheduleAdvertiserAutoConfirmation(orderId: string, runAt: Date) {
    return this.orderQueue.add("advertiser-auto-confirmation", { orderId }, { delay: Math.max(0, runAt.getTime() - Date.now()) });
  }

  queueTelegramNotification(notificationId: string) {
    return this.notificationQueue.add("telegram-notification", { notificationId });
  }
}
