import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AdOrderStatus, ModerationStatus, PublicationMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../finance/ledger.service";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService
  ) {}

  async createOrder(input: {
    advertiserProfileId: string;
    channelId: string;
    placementFormatId: string;
    postText: string;
    mediaUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
    publicationDate: string;
    publicationWindowStart: string;
    publicationWindowEnd: string;
  }) {
    const price = await this.prisma.channelPlacementPrice.findUnique({
      where: {
        channelId_placementFormatId: {
          channelId: input.channelId,
          placementFormatId: input.placementFormatId
        }
      },
      include: { channel: true }
    });
    if (!price || !price.isEnabled) {
      throw new NotFoundException("Placement format price not found");
    }

    const moderationEnabled = await this.getBooleanSetting("moderation_enabled", false);
    const commissionBps = await this.getNumberSetting("platform_commission_bps", 2000);
    const ownerTimeoutHours = await this.getNumberSetting("owner_response_timeout_hours", 48);

    const windowStart = new Date(input.publicationWindowStart);
    const windowEnd = new Date(input.publicationWindowEnd);
    if (windowStart >= windowEnd) {
      throw new BadRequestException("Publication window start must be before end");
    }

    const order = await this.prisma.adOrder.create({
      data: {
        advertiserProfileId: input.advertiserProfileId,
        ownerProfileId: price.channel.ownerProfileId,
        channelId: input.channelId,
        placementFormatId: input.placementFormatId,
        amount: price.price,
        currency: price.currency,
        platformCommissionBps: commissionBps,
        moderationStatus: moderationEnabled ? ModerationStatus.awaiting_moderation : ModerationStatus.not_required,
        status: AdOrderStatus.created,
        postText: input.postText,
        mediaUrl: input.mediaUrl,
        buttonText: input.buttonText,
        buttonUrl: input.buttonUrl,
        publicationDate: new Date(input.publicationDate),
        publicationWindowStart: windowStart,
        publicationWindowEnd: windowEnd,
        ownerResponseDeadline: this.addHours(new Date(), ownerTimeoutHours)
      }
    });

    await this.ledger.freezeAdvertiserFunds({
      advertiserProfileId: input.advertiserProfileId,
      orderId: order.id,
      amount: price.price,
      currency: price.currency
    });

    const nextStatus = moderationEnabled ? AdOrderStatus.awaiting_moderation : AdOrderStatus.sent_to_owner;
    return this.setStatus(order.id, nextStatus);
  }

  async acceptByOwner(orderId: string, scheduledPublicationAt: Date) {
    const order = await this.requireOrder(orderId);
    if (scheduledPublicationAt < order.publicationWindowStart || scheduledPublicationAt > order.publicationWindowEnd) {
      throw new BadRequestException("Scheduled publication time must be inside advertiser window");
    }

    return this.prisma.adOrder.update({
      where: { id: orderId },
      data: {
        status: AdOrderStatus.scheduled_for_publication,
        scheduledPublicationAt,
        manualPublicationDeadline:
          order.channel.publicationMode === PublicationMode.manual
            ? this.addHours(scheduledPublicationAt, await this.getNumberSetting("manual_publication_timeout_hours", 2))
            : undefined
      }
    });
  }

  async declineByOwner(orderId: string) {
    await this.setStatus(orderId, AdOrderStatus.declined_by_owner);
    return this.ledger.unfreezeToAdvertiser({ orderId });
  }

  async markPublished(orderId: string, publishedPostUrl: string) {
    const timeoutHours = await this.getNumberSetting("advertiser_confirmation_timeout_hours", 48);
    return this.prisma.adOrder.update({
      where: { id: orderId },
      data: {
        status: AdOrderStatus.awaiting_advertiser_confirmation,
        publishedAt: new Date(),
        publishedPostUrl,
        advertiserConfirmationDeadline: this.addHours(new Date(), timeoutHours)
      }
    });
  }

  async confirmPublication(orderId: string) {
    await this.setStatus(orderId, AdOrderStatus.approved_by_advertiser);
    return this.ledger.completeOrderDistribution(orderId);
  }

  async setStatus(orderId: string, status: AdOrderStatus, comment?: string) {
    const order = await this.requireOrder(orderId);
    const updated = await this.prisma.adOrder.update({
      where: { id: orderId },
      data: { status }
    });
    await this.prisma.adOrderStatusLog.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: status,
        comment
      }
    });
    return updated;
  }

  private async requireOrder(orderId: string) {
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
      include: { channel: true }
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  private async getBooleanSetting(key: string, fallback: boolean) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    return typeof setting?.value === "boolean" ? setting.value : fallback;
  }

  private async getNumberSetting(key: string, fallback: number) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    return typeof setting?.value === "number" ? setting.value : fallback;
  }

  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
