import { Body, Controller, Param, Patch, Post } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  createOrder(@Body() body: Parameters<OrdersService["createOrder"]>[0]) {
    return this.orders.createOrder(body);
  }

  @Patch(":id/accept")
  acceptOrder(@Param("id") orderId: string, @Body("scheduledPublicationAt") scheduledPublicationAt: string) {
    return this.orders.acceptByOwner(orderId, new Date(scheduledPublicationAt));
  }

  @Patch(":id/decline")
  declineOrder(@Param("id") orderId: string) {
    return this.orders.declineByOwner(orderId);
  }

  @Patch(":id/published")
  markPublished(@Param("id") orderId: string, @Body("publishedPostUrl") publishedPostUrl: string) {
    return this.orders.markPublished(orderId, publishedPostUrl);
  }

  @Patch(":id/confirm")
  confirmPublication(@Param("id") orderId: string) {
    return this.orders.confirmPublication(orderId);
  }
}
