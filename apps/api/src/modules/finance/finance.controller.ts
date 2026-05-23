import { Body, Controller, Param, Patch, Post } from "@nestjs/common";
import { PayoutRecipientType, PayoutStatus, Prisma } from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { PayoutsService } from "./payouts.service";

@Controller("finance")
export class FinanceController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService
  ) {}

  @Post("payments/yookassa/top-up")
  createTopUp(@Body() body: { userId: string; amount: string; currency?: string }) {
    return this.payments.createYookassaTopUp(body);
  }

  @Post("payments/yookassa/webhook")
  handleYookassaWebhook(@Body() body: { eventId?: string; eventType?: string; payload: unknown }) {
    return this.payments.handleYookassaWebhook(body);
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
