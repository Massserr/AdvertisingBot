import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentProvider, PaymentStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "./ledger.service";

type YookassaPaymentObject = {
  id: string;
  status: PaymentStatus;
  amount?: {
    value: string;
    currency: string;
  };
  confirmation?: {
    confirmation_url?: string;
  };
  metadata?: {
    paymentId?: string;
    userId?: string;
  };
};

type YookassaWebhookBody = {
  id?: string;
  type?: string;
  event?: string;
  object?: YookassaPaymentObject;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly config: ConfigService
  ) {}

  getAdvertiserBalance(userId: string) {
    return this.prisma.advertiserProfile.findUniqueOrThrow({
      where: { userId },
      select: {
        id: true,
        name: true,
        balanceAvailable: true,
        balanceFrozen: true,
        updatedAt: true
      }
    });
  }

  listUserPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  }

  async createYookassaTopUp(input: { userId: string; amount: string; currency?: string }) {
    const advertiserProfile = await this.prisma.advertiserProfile.findUnique({ where: { userId: input.userId } });
    if (!advertiserProfile) {
      throw new NotFoundException("Advertiser profile not found");
    }

    const amount = new Prisma.Decimal(input.amount);
    if (!amount.isFinite() || amount.lte(0)) {
      throw new BadRequestException("Top-up amount must be greater than zero");
    }

    const currency = input.currency ?? "RUB";
    const payment = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        amount,
        currency,
        idempotencyKey: randomUUID(),
        status: PaymentStatus.pending,
        provider: PaymentProvider.yookassa
      }
    });

    if (this.shouldUseMockPayments()) {
      const mockPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId: `mock_${payment.id}`,
          confirmationUrl: this.mockConfirmationUrl(payment.id),
          rawPayload: {
            provider: "mock",
            status: PaymentStatus.pending,
            reason: "YooKassa credentials are not configured"
          }
        }
      });

      return {
        payment: mockPayment,
        confirmationUrl: mockPayment.confirmationUrl,
        mock: true
      };
    }

    const yookassaPayment = await this.createPaymentInYookassa(payment.id, input.userId, amount, currency, payment.idempotencyKey);
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalPaymentId: yookassaPayment.id,
        status: yookassaPayment.status,
        confirmationUrl: yookassaPayment.confirmation?.confirmation_url,
        rawPayload: yookassaPayment as unknown as Prisma.InputJsonValue
      }
    });

    return {
      payment: updatedPayment,
      confirmationUrl: updatedPayment.confirmationUrl,
      mock: false
    };
  }

  async mockSucceedPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { transactions: true }
    });
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (!payment.externalPaymentId?.startsWith("mock_")) {
      throw new BadRequestException("Only mock payments can be completed through this endpoint");
    }

    if (payment.transactions.some((transaction) => transaction.type === "deposit")) {
      return payment;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.succeeded,
        rawPayload: {
          provider: "mock",
          status: PaymentStatus.succeeded,
          completedAt: new Date().toISOString()
        }
      }
    });

    await this.ledger.creditDeposit({
      userId: payment.userId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency
    });

    return this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  async handleYookassaWebhook(body: YookassaWebhookBody) {
    const eventType = body.event ?? body.type ?? "unknown";
    const externalPaymentId = body.object?.id;
    const status = body.object?.status;
    const idempotencyKey = [eventType, externalPaymentId, status].filter(Boolean).join(":") || undefined;

    const duplicateLog = idempotencyKey
      ? await this.prisma.webhookLog.findFirst({
          where: {
            provider: "yookassa",
            idempotencyKey,
            processedAt: { not: null }
          }
        })
      : null;
    if (duplicateLog) {
      return { ok: true, duplicate: true, logId: duplicateLog.id };
    }

    const log = await this.prisma.webhookLog.create({
      data: {
        provider: "yookassa",
        eventId: body.id ?? externalPaymentId,
        eventType,
        idempotencyKey,
        payload: body as unknown as Prisma.InputJsonValue
      }
    });

    try {
      if (!externalPaymentId || !status) {
        return await this.markWebhookProcessed(log.id);
      }

      const payment = await this.findPaymentFromWebhook(externalPaymentId, body.object?.metadata?.paymentId);
      if (!payment) {
        return await this.markWebhookProcessed(log.id);
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          rawPayload: body as unknown as Prisma.InputJsonValue
        }
      });

      if (status === PaymentStatus.succeeded) {
        const existingDeposit = await this.prisma.financialTransaction.findFirst({
          where: { paymentId: payment.id, type: "deposit" }
        });

        if (!existingDeposit) {
          await this.ledger.creditDeposit({
            userId: payment.userId,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency
          });
        }
      }

      return await this.markWebhookProcessed(log.id);
    } catch (error) {
      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: { error: error instanceof Error ? error.message : "Unknown webhook error" }
      });
      throw error;
    }
  }

  private async findPaymentFromWebhook(externalPaymentId: string, localPaymentId?: string) {
    if (localPaymentId) {
      const byLocalId = await this.prisma.payment.findUnique({ where: { id: localPaymentId } });
      if (byLocalId) {
        return byLocalId;
      }
    }

    return this.prisma.payment.findUnique({ where: { externalPaymentId } });
  }

  private markWebhookProcessed(logId: string) {
    return this.prisma.webhookLog.update({
      where: { id: logId },
      data: { processedAt: new Date() }
    });
  }

  private async createPaymentInYookassa(
    paymentId: string,
    userId: string,
    amount: Prisma.Decimal,
    currency: string,
    idempotencyKey: string
  ): Promise<YookassaPaymentObject> {
    const shopId = this.config.get<string>("YOOKASSA_SHOP_ID");
    const secretKey = this.config.get<string>("YOOKASSA_SECRET_KEY");
    if (!shopId || !secretKey) {
      throw new BadRequestException("YooKassa credentials are not configured");
    }

    const returnUrl =
      this.config.get<string>("YOOKASSA_RETURN_URL") ||
      `${this.config.get<string>("MINI_APP_URL", "http://localhost:3000")}`;

    const response = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotence-Key": idempotencyKey
      },
      body: JSON.stringify({
        amount: {
          value: amount.toFixed(2),
          currency
        },
        capture: true,
        confirmation: {
          type: "redirect",
          return_url: returnUrl
        },
        description: `Пополнение баланса AdBot ${paymentId}`,
        metadata: {
          paymentId,
          userId
        }
      })
    });

    const payload = (await response.json().catch(() => null)) as YookassaPaymentObject | { description?: string } | null;
    if (!response.ok) {
      throw new BadRequestException(
        payload && "description" in payload && payload.description ? payload.description : "YooKassa payment creation failed"
      );
    }

    return payload as YookassaPaymentObject;
  }

  private shouldUseMockPayments() {
    const explicitMock = this.config.get<string>("YOOKASSA_MOCK_PAYMENTS") === "true";
    const shopId = this.config.get<string>("YOOKASSA_SHOP_ID", "");
    const secretKey = this.config.get<string>("YOOKASSA_SECRET_KEY", "");
    return explicitMock || !shopId || !secretKey || shopId === "replace-me" || secretKey === "replace-me";
  }

  private mockConfirmationUrl(paymentId: string) {
    const apiPublicUrl = this.config.get<string>("API_PUBLIC_URL", "http://localhost:4000").replace(/\/$/, "");
    return `${apiPublicUrl}/api/finance/payments/${paymentId}/mock-succeed`;
  }
}
