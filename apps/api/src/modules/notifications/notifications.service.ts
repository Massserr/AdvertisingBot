import { Injectable } from "@nestjs/common";
import { NotificationChannel, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  queue(input: {
    userId?: string;
    channel: NotificationChannel;
    type: string;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: input
    });
  }
}
