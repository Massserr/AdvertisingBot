import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FinancialTransactionType, PayoutProvider, PayoutRecipientType, PayoutStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async requestPayout(input: {
    ownerProfileId: string;
    amount: Prisma.Decimal.Value;
    recipientType: PayoutRecipientType;
    payoutDetails: Prisma.InputJsonValue;
    payoutMethodId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.ownerProfile.findUnique({ where: { id: input.ownerProfileId } });
      if (!owner) {
        throw new NotFoundException("Owner profile not found");
      }

      const amount = new Prisma.Decimal(input.amount);
      if (owner.balanceAvailable.lt(amount)) {
        throw new BadRequestException("Insufficient owner balance");
      }

      const payout = await tx.payoutRequest.create({
        data: {
          ownerProfileId: owner.id,
          payoutMethodId: input.payoutMethodId,
          provider: PayoutProvider.manual,
          recipientType: input.recipientType,
          amount,
          currency: "RUB",
          payoutDetails: input.payoutDetails,
          status: PayoutStatus.requested
        }
      });

      await tx.ownerProfile.update({
        where: { id: owner.id },
        data: {
          balanceAvailable: { decrement: amount },
          balanceProcessing: { increment: amount }
        }
      });

      await tx.financialTransaction.create({
        data: {
          userId: owner.userId,
          payoutRequestId: payout.id,
          type: FinancialTransactionType.payout_requested,
          amount,
          currency: payout.currency
        }
      });

      return payout;
    });
  }

  async setManualPayoutStatus(input: { payoutRequestId: string; status: PayoutStatus; adminComment?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({
        where: { id: input.payoutRequestId },
        include: { ownerProfile: true }
      });
      if (!payout) {
        throw new NotFoundException("Payout request not found");
      }

      const alreadyFinal =
        payout.status === PayoutStatus.paid ||
        payout.status === PayoutStatus.rejected ||
        payout.status === PayoutStatus.failed;
      if (alreadyFinal) {
        throw new BadRequestException("Payout request is already finalized");
      }

      const updated = await tx.payoutRequest.update({
        where: { id: input.payoutRequestId },
        data: {
          status: input.status,
          adminComment: input.adminComment,
          processedAt: input.status === PayoutStatus.paid ? new Date() : undefined
        }
      });

      if (input.status === PayoutStatus.processing) {
        await tx.financialTransaction.create({
          data: {
            userId: payout.ownerProfile.userId,
            payoutRequestId: payout.id,
            type: FinancialTransactionType.payout_processing,
            amount: payout.amount,
            currency: payout.currency,
            adminComment: input.adminComment
          }
        });
      }

      if (input.status === PayoutStatus.paid) {
        await tx.ownerProfile.update({
          where: { id: payout.ownerProfileId },
          data: {
            balanceProcessing: { decrement: payout.amount },
            balanceWithdrawn: { increment: payout.amount }
          }
        });
        await tx.financialTransaction.create({
          data: {
            userId: payout.ownerProfile.userId,
            payoutRequestId: payout.id,
            type: FinancialTransactionType.payout_completed,
            amount: payout.amount,
            currency: payout.currency,
            adminComment: input.adminComment
          }
        });
      }

      if (input.status === PayoutStatus.rejected || input.status === PayoutStatus.failed) {
        await tx.ownerProfile.update({
          where: { id: payout.ownerProfileId },
          data: {
            balanceAvailable: { increment: payout.amount },
            balanceProcessing: { decrement: payout.amount }
          }
        });
        await tx.financialTransaction.create({
          data: {
            userId: payout.ownerProfile.userId,
            payoutRequestId: payout.id,
            type: input.status === PayoutStatus.rejected ? FinancialTransactionType.payout_rejected : FinancialTransactionType.payout_failed,
            amount: payout.amount,
            currency: payout.currency,
            adminComment: input.adminComment
          }
        });
      }

      return updated;
    });
  }
}
