import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "./ledger.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

  async createYookassaTopUp(input: { userId: string; amount: string; currency?: string }) {
    const payment = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        amount: input.amount,
        currency: input.currency ?? "RUB",
        idempotencyKey: randomUUID()
      }
    });

    return {
      payment,
      confirmationUrl: null,
      next: "Call Yookassa API with payment.idempotencyKey, then save externalPaymentId and confirmationUrl"
    };
  }

  async handleYookassaWebhook(input: { eventId?: string; eventType?: string; payload: any }) {
    const log = await this.prisma.webhookLog.create({
      data: {
        provider: "yookassa",
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload
      }
    });

    const externalPaymentId = input.payload?.object?.id;
    const status = input.payload?.object?.status as PaymentStatus | undefined;
    if (!externalPaymentId || status !== PaymentStatus.succeeded) {
      return this.prisma.webhookLog.update({
        where: { id: log.id },
        data: { processedAt: new Date() }
      });
    }

    const payment = await this.prisma.payment.findUnique({
      where: { externalPaymentId },
      include: { transactions: true }
    });
    if (!payment || payment.transactions.length > 0) {
      return this.prisma.webhookLog.update({
        where: { id: log.id },
        data: { processedAt: new Date() }
      });
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.succeeded, rawPayload: input.payload }
    });
    await this.ledger.creditDeposit({
      userId: payment.userId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency
    });

    return this.prisma.webhookLog.update({
      where: { id: log.id },
      data: { processedAt: new Date() }
    });
  }
}
