import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PayoutRecipientType, PayoutStatus, Prisma, UserRole } from "@prisma/client";
import { LedgerService } from "./ledger.service";
import { PaymentsService } from "./payments.service";
import { PayoutsService } from "./payouts.service";

@Controller("finance")
export class FinanceController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly ledger: LedgerService
  ) {}

  @Get("advertisers/:userId/balance")
  getAdvertiserBalance(@Param("userId") userId: string) {
    return this.payments.getAdvertiserBalance(userId);
  }

  @Get("users/:userId/payments")
  listUserPayments(@Param("userId") userId: string) {
    return this.payments.listUserPayments(userId);
  }

  @Get("users/:userId/transactions")
  listUserTransactions(@Param("userId") userId: string) {
    return this.ledger.listUserTransactions(userId);
  }

  @Post("payments/yookassa/top-up")
  createTopUp(@Body() body: { userId: string; amount: string; currency?: string }) {
    return this.payments.createYookassaTopUp(body);
  }

  @Post("payments/yookassa/webhook")
  handleYookassaWebhook(@Body() body: unknown) {
    return this.payments.handleYookassaWebhook(body as Parameters<PaymentsService["handleYookassaWebhook"]>[0]);
  }

  @Post("payments/:id/mock-succeed")
  mockSucceedPayment(@Param("id") paymentId: string) {
    return this.payments.mockSucceedPayment(paymentId);
  }

  @Post("manual-adjustments")
  manualAdjustment(@Body() body: { userId: string; amount: string; currency?: string; comment: string; role: UserRole }) {
    return this.ledger.manualAdjustment({
      userId: body.userId,
      amount: body.amount,
      currency: body.currency ?? "RUB",
      comment: body.comment,
      role: body.role
    });
  }

  @Post("payouts")
  requestPayout(
    @Body()
    body: {
      ownerProfileId: string;
      amount: string;
      recipientType: PayoutRecipientType;
      payoutDetails: Prisma.InputJsonValue;
      payoutMethodId?: string;
    }
  ) {
    return this.payouts.requestPayout(body);
  }

  @Patch("payouts/:id/status")
  setPayoutStatus(@Param("id") payoutRequestId: string, @Body() body: { status: PayoutStatus; adminComment?: string }) {
    return this.payouts.setManualPayoutStatus({ payoutRequestId, ...body });
  }
}
