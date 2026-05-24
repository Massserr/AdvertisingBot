import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AdOrderStatus, FinancialTransactionStatus, FinancialTransactionType, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  listUserTransactions(userId: string) {
    return this.prisma.financialTransaction.findMany({
      where: { userId },
      include: {
        order: {
          include: {
            channel: true,
            placementFormat: true
          }
        },
        payment: true,
        payoutRequest: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async creditDeposit(input: { userId: string; paymentId: string; amount: Prisma.Decimal.Value; currency: string }) {
    return this.prisma.$transaction(async (tx) => {
      const existingDeposit = await tx.financialTransaction.findFirst({
        where: { paymentId: input.paymentId, type: FinancialTransactionType.deposit }
      });
      if (existingDeposit) {
        return existingDeposit;
      }

      const profile = await tx.advertiserProfile.findUnique({ where: { userId: input.userId } });
      if (!profile) {
        throw new NotFoundException("Advertiser profile not found");
      }

      await tx.advertiserProfile.update({
        where: { id: profile.id },
        data: { balanceAvailable: { increment: input.amount } }
      });

      return tx.financialTransaction.create({
        data: {
          userId: input.userId,
          paymentId: input.paymentId,
          type: FinancialTransactionType.deposit,
          status: FinancialTransactionStatus.completed,
          amount: input.amount,
          currency: input.currency
        }
      });
    });
  }

  async freezeAdvertiserFunds(input: { advertiserProfileId: string; orderId: string; amount: Prisma.Decimal.Value; currency: string }) {
    return this.prisma.$transaction(async (tx) => {
      const existingFreeze = await tx.financialTransaction.findFirst({
        where: { orderId: input.orderId, type: FinancialTransactionType.freeze }
      });
      if (existingFreeze) {
        return existingFreeze;
      }

      const profile = await tx.advertiserProfile.findUnique({
        where: { id: input.advertiserProfileId },
        include: { user: true }
      });
      if (!profile) {
        throw new NotFoundException("Advertiser profile not found");
      }

      const amount = new Prisma.Decimal(input.amount);
      if (profile.balanceAvailable.lt(amount)) {
        throw new BadRequestException("Insufficient advertiser balance");
      }

      await tx.advertiserProfile.update({
        where: { id: profile.id },
        data: {
          balanceAvailable: { decrement: amount },
          balanceFrozen: { increment: amount }
        }
      });

      const order = await tx.adOrder.findUnique({ where: { id: input.orderId } });

      await tx.adOrder.update({
        where: { id: input.orderId },
        data: { status: AdOrderStatus.funds_frozen }
      });

      if (order && order.status !== AdOrderStatus.funds_frozen) {
        await tx.adOrderStatusLog.create({
          data: {
            orderId: input.orderId,
            fromStatus: order.status,
            toStatus: AdOrderStatus.funds_frozen,
            comment: "Advertiser funds frozen"
          }
        });
      }

      return tx.financialTransaction.create({
        data: {
          userId: profile.userId,
          orderId: input.orderId,
          type: FinancialTransactionType.freeze,
          amount,
          currency: input.currency
        }
      });
    });
  }

  async unfreezeToAdvertiser(input: { orderId: string; comment?: string; finalStatus?: AdOrderStatus }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.adOrder.findUnique({
        where: { id: input.orderId },
        include: { advertiserProfile: true }
      });
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      await tx.advertiserProfile.update({
        where: { id: order.advertiserProfileId },
        data: {
          balanceAvailable: { increment: order.amount },
          balanceFrozen: { decrement: order.amount }
        }
      });

      const finalStatus = input.finalStatus ?? AdOrderStatus.refunded;

      await tx.adOrder.update({
        where: { id: order.id },
        data: { status: finalStatus }
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: finalStatus,
          comment: input.comment
        }
      });

      return tx.financialTransaction.create({
        data: {
          userId: order.advertiserProfile.userId,
          orderId: order.id,
          type: FinancialTransactionType.refund,
          amount: order.amount,
          currency: order.currency,
          adminComment: input.comment
        }
      });
    });
  }

  async completeOrderDistribution(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.adOrder.findUnique({
        where: { id: orderId },
        include: {
          advertiserProfile: true,
          ownerProfile: true
        }
      });
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const amount = new Prisma.Decimal(order.amount);
      const ownerShare = amount.mul(10000 - order.platformCommissionBps).div(10000).toDecimalPlaces(2);
      const platformFee = amount.sub(ownerShare);

      await tx.advertiserProfile.update({
        where: { id: order.advertiserProfileId },
        data: { balanceFrozen: { decrement: amount } }
      });

      await tx.ownerProfile.update({
        where: { id: order.ownerProfileId },
        data: {
          balanceEarned: { increment: ownerShare },
          balanceAvailable: { increment: ownerShare }
        }
      });

      await tx.adOrder.update({
        where: { id: order.id },
        data: { status: AdOrderStatus.completed }
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: AdOrderStatus.completed,
          comment: "Funds distributed between owner and platform"
        }
      });

      await tx.financialTransaction.create({
        data: {
          userId: order.ownerProfile.userId,
          orderId: order.id,
          type: FinancialTransactionType.owner_reward,
          amount: ownerShare,
          currency: order.currency
        }
      });

      return tx.financialTransaction.create({
        data: {
          userId: order.advertiserProfile.userId,
          orderId: order.id,
          type: FinancialTransactionType.platform_fee,
          amount: platformFee,
          currency: order.currency
        }
      });
    });
  }

  async manualAdjustment(input: { userId: string; amount: Prisma.Decimal.Value; currency: string; comment: string; role: UserRole }) {
    return this.prisma.$transaction(async (tx) => {
      if (input.role === UserRole.advertiser) {
        await tx.advertiserProfile.update({
          where: { userId: input.userId },
          data: { balanceAvailable: { increment: input.amount } }
        });
      }

      if (input.role === UserRole.owner) {
        await tx.ownerProfile.update({
          where: { userId: input.userId },
          data: { balanceAvailable: { increment: input.amount } }
        });
      }

      return tx.financialTransaction.create({
        data: {
          userId: input.userId,
          type: FinancialTransactionType.manual_adjustment,
          amount: input.amount,
          currency: input.currency,
          adminComment: input.comment
        }
      });
    });
  }
}
