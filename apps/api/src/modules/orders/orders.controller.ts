import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateOrderForUserInput, CreateOrderInput, OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(":id")
  getOrder(@Param("id") orderId: string) {
    return this.orders.getOrder(orderId);
  }

  @Get("advertisers/:userId/list")
  listAdvertiserOrders(@Param("userId") userId: string) {
    return this.orders.listAdvertiserOrders(userId);
  }

  @Get("owners/:userId/list")
  listOwnerOrders(@Param("userId") userId: string) {
    return this.orders.listOwnerOrders(userId);
  }

  @Post()
  createOrder(@Body() body: CreateOrderInput) {
    return this.orders.createOrder(body);
  }

  @Post("advertisers/:userId")
  createAdvertiserOrder(@Param("userId") userId: string, @Body() body: CreateOrderForUserInput) {
    return this.orders.createOrderForUser(userId, body);
  }

  @Patch(":id/accept")
  acceptOrder(@Param("id") orderId: string, @Body("scheduledPublicationAt") scheduledPublicationAt: string) {
    return this.orders.acceptByOwner(orderId, new Date(scheduledPublicationAt));
  }

  @Patch("owners/:userId/:id/accept")
  acceptOwnerOrder(
    @Param("userId") userId: string,
    @Param("id") orderId: string,
    @Body("scheduledPublicationAt") scheduledPublicationAt: string
  ) {
    return this.orders.acceptByOwner(orderId, new Date(scheduledPublicationAt), userId);
  }

  @Patch(":id/decline")
  declineOrder(@Param("id") orderId: string) {
    return this.orders.declineByOwner(orderId);
  }

  @Patch("owners/:userId/:id/decline")
  declineOwnerOrder(@Param("userId") userId: string, @Param("id") orderId: string) {
    return this.orders.declineByOwner(orderId, userId);
  }

  @Patch(":id/published")
  markPublished(@Param("id") orderId: string, @Body("publishedPostUrl") publishedPostUrl: string) {
    return this.orders.markPublished(orderId, publishedPostUrl);
  }

  @Patch("owners/:userId/:id/published")
  markOwnerPublished(@Param("userId") userId: string, @Param("id") orderId: string, @Body("publishedPostUrl") publishedPostUrl: string) {
    return this.orders.markPublished(orderId, publishedPostUrl, userId);
  }

  @Patch(":id/confirm")
  confirmPublication(@Param("id") orderId: string) {
    return this.orders.confirmPublication(orderId);
  }
}
