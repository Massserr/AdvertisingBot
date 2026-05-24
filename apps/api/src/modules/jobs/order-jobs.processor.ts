import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { OrdersService } from "../orders/orders.service";
import { ORDER_QUEUE } from "./jobs.constants";

type OrderJobPayload = {
  orderId: string;
};

@Processor(ORDER_QUEUE)
export class OrderJobsProcessor extends WorkerHost {
  constructor(private readonly orders: OrdersService) {
    super();
  }

  async process(job: Job<OrderJobPayload>) {
    if (job.name === "owner-timeout") {
      return this.orders.expireOwnerTimeout(job.data.orderId);
    }

    if (job.name === "auto-publication") {
      return this.orders.autoPublishOrder(job.data.orderId);
    }

    if (job.name === "advertiser-auto-confirmation") {
      return this.orders.autoConfirmPublication(job.data.orderId);
    }

    return null;
  }
}
