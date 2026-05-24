import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdOrderStatus, AdPostType, ChannelStatus, ModerationStatus, PublicationMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LedgerService } from "../finance/ledger.service";
import { JobsService } from "../jobs/jobs.service";

export type CreateOrderInput = {
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
};

export type CreateOrderForUserInput = Omit<CreateOrderInput, "advertiserProfileId">;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly jobs: JobsService,
    private readonly config: ConfigService
  ) {}

  listAdvertiserOrders(userId: string) {
    return this.prisma.adOrder.findMany({
      where: { advertiserProfile: { userId } },
      include: this.orderInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  listOwnerOrders(userId: string) {
    return this.prisma.adOrder.findMany({
      where: { ownerProfile: { userId } },
      include: this.orderInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
      include: this.orderInclude()
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async createOrderForUser(userId: string, input: CreateOrderForUserInput) {
    const advertiserProfile = await this.prisma.advertiserProfile.findUnique({ where: { userId } });
    if (!advertiserProfile) {
      throw new BadRequestException("Create an advertiser profile before creating orders");
    }

    return this.createOrder({ ...input, advertiserProfileId: advertiserProfile.id });
  }

  async createOrder(input: CreateOrderInput) {
    const price = await this.prisma.channelPlacementPrice.findUnique({
      where: {
        channelId_placementFormatId: {
          channelId: input.channelId,
          placementFormatId: input.placementFormatId
        }
      },
      include: {
        channel: {
          include: {
            category: true,
            ownerProfile: true
          }
        },
        placementFormat: true
      }
    });
    if (!price || !price.isEnabled) {
      throw new NotFoundException("Placement format price not found");
    }

    if (price.channel.status !== ChannelStatus.verified) {
      throw new BadRequestException("Only verified channels can accept ad orders");
    }

    const advertiserProfile = await this.prisma.advertiserProfile.findUnique({ where: { id: input.advertiserProfileId } });
    if (!advertiserProfile) {
      throw new NotFoundException("Advertiser profile not found");
    }

    const postText = input.postText.trim();
    if (postText.length < 5) {
      throw new BadRequestException("Ad post text is too short");
    }

    const publicationDate = this.parseDate(input.publicationDate, "Publication date is invalid");
    const windowStart = this.parseDate(input.publicationWindowStart, "Publication window start is invalid");
    const windowEnd = this.parseDate(input.publicationWindowEnd, "Publication window end is invalid");
    if (windowStart >= windowEnd) {
      throw new BadRequestException("Publication window start must be before end");
    }

    if (!this.isSameCalendarDate(publicationDate, windowStart) || !this.isSameCalendarDate(publicationDate, windowEnd)) {
      throw new BadRequestException("Publication window must be inside one calendar date");
    }

    const commissionBps = await this.getNumberSetting("platform_commission_bps", 2000);
    const ownerTimeoutHours = await this.getNumberSetting("owner_response_timeout_hours", 48);
    const moderationEnabled = await this.getBooleanSetting("moderation_enabled", false);

    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.adOrder.create({
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
          postType: this.resolvePostType(input),
          postText,
          mediaUrl: input.mediaUrl?.trim() || null,
          buttonText: input.buttonText?.trim() || null,
          buttonUrl: input.buttonUrl?.trim() || null,
          publicationDate,
          publicationWindowStart: windowStart,
          publicationWindowEnd: windowEnd,
          ownerResponseDeadline: this.addHours(new Date(), ownerTimeoutHours)
        }
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: AdOrderStatus.created,
          comment: "Order created"
        }
      });

      return tx.adOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: this.orderInclude()
      });
    });

    await this.ledger.freezeAdvertiserFunds({
      advertiserProfileId: input.advertiserProfileId,
      orderId: createdOrder.id,
      amount: price.price,
      currency: price.currency
    });

    const targetStatus = moderationEnabled ? AdOrderStatus.awaiting_moderation : AdOrderStatus.sent_to_owner;
    const nextOrder = await this.setStatus(createdOrder.id, targetStatus);

    if (targetStatus === AdOrderStatus.sent_to_owner) {
      await this.scheduleJob(() => this.jobs.scheduleOwnerTimeout(nextOrder.id, nextOrder.ownerResponseDeadline), "owner response timeout");
    }

    return nextOrder;
  }

  async acceptByOwner(orderId: string, scheduledPublicationAt: Date, ownerUserId?: string) {
    const order = await this.requireOrder(orderId);
    this.ensureOwnerAccess(order, ownerUserId);

    if (Number.isNaN(scheduledPublicationAt.getTime())) {
      throw new BadRequestException("Scheduled publication time is invalid");
    }

    if (order.status !== AdOrderStatus.sent_to_owner) {
      throw new BadRequestException("Only orders sent to owner can be accepted");
    }

    if (scheduledPublicationAt < order.publicationWindowStart || scheduledPublicationAt > order.publicationWindowEnd) {
      throw new BadRequestException("Scheduled publication time must be inside advertiser window");
    }

    const manualTimeoutHours = await this.getNumberSetting("manual_publication_timeout_hours", 2);
    const manualPublicationDeadline =
      order.channel.publicationMode === PublicationMode.manual ? this.addHours(scheduledPublicationAt, manualTimeoutHours) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.adOrder.update({
        where: { id: orderId },
        data: {
          status: AdOrderStatus.scheduled_for_publication,
          scheduledPublicationAt,
          manualPublicationDeadline,
          autoPublishError: null
        },
        include: this.orderInclude()
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: AdOrderStatus.accepted_by_owner,
          comment: "Owner accepted the order"
        }
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId,
          fromStatus: AdOrderStatus.accepted_by_owner,
          toStatus: AdOrderStatus.scheduled_for_publication,
          comment: "Publication time selected by owner"
        }
      });

      return nextOrder;
    });

    if (order.channel.publicationMode === PublicationMode.automatic) {
      await this.scheduleJob(() => this.jobs.scheduleAutoPublication(orderId, scheduledPublicationAt), "auto-publication");
    }

    return updated;
  }

  async declineByOwner(orderId: string, ownerUserId?: string) {
    const order = await this.requireOrder(orderId);
    this.ensureOwnerAccess(order, ownerUserId);

    if (order.status !== AdOrderStatus.sent_to_owner) {
      throw new BadRequestException("Only orders sent to owner can be declined");
    }

    await this.ledger.unfreezeToAdvertiser({
      orderId,
      comment: "Order declined by owner",
      finalStatus: AdOrderStatus.declined_by_owner
    });
    return this.getOrder(orderId);
  }

  async markPublished(orderId: string, publishedPostUrl: string, ownerUserId?: string) {
    const order = await this.requireOrder(orderId);
    this.ensureOwnerAccess(order, ownerUserId);

    if (order.status !== AdOrderStatus.scheduled_for_publication && order.status !== AdOrderStatus.auto_publish_failed) {
      throw new BadRequestException("Only scheduled or failed auto-publication orders can be marked as published");
    }

    const trimmedUrl = publishedPostUrl.trim();
    if (!this.isHttpUrl(trimmedUrl)) {
      throw new BadRequestException("Published post URL must be a valid http or https URL");
    }

    const timeoutHours = await this.getNumberSetting("advertiser_confirmation_timeout_hours", 48);
    const publishedAt = new Date();
    const advertiserConfirmationDeadline = this.addHours(publishedAt, timeoutHours);

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextOrder = await tx.adOrder.update({
        where: { id: orderId },
        data: {
          status: AdOrderStatus.awaiting_advertiser_confirmation,
          publishedAt,
          publishedPostUrl: trimmedUrl,
          advertiserConfirmationDeadline,
          manualPublicationDeadline: null
        },
        include: this.orderInclude()
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: AdOrderStatus.published,
          comment: "Published post URL received"
        }
      });

      await tx.adOrderStatusLog.create({
        data: {
          orderId,
          fromStatus: AdOrderStatus.published,
          toStatus: AdOrderStatus.awaiting_advertiser_confirmation,
          comment: "Waiting for advertiser confirmation"
        }
      });

      return nextOrder;
    });

    await this.scheduleJob(
      () => this.jobs.scheduleAdvertiserAutoConfirmation(orderId, advertiserConfirmationDeadline),
      "advertiser auto-confirmation"
    );

    return updated;
  }

  async confirmPublication(orderId: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== AdOrderStatus.awaiting_advertiser_confirmation) {
      throw new BadRequestException("Only published orders awaiting confirmation can be confirmed");
    }

    await this.setStatus(orderId, AdOrderStatus.approved_by_advertiser);
    return this.ledger.completeOrderDistribution(orderId);
  }

  async expireOwnerTimeout(orderId: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== AdOrderStatus.sent_to_owner) {
      return order;
    }

    await this.ledger.unfreezeToAdvertiser({
      orderId,
      comment: "Owner response timeout",
      finalStatus: AdOrderStatus.expired_by_owner_timeout
    });
    return this.getOrder(orderId);
  }

  async autoPublishOrder(orderId: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== AdOrderStatus.scheduled_for_publication || order.channel.publicationMode !== PublicationMode.automatic) {
      return order;
    }

    try {
      const publishedPostUrl = await this.publishOrderToTelegram(order);
      return this.markPublished(orderId, publishedPostUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown auto-publication error";
      const manualTimeoutHours = await this.getNumberSetting("manual_publication_timeout_hours", 2);
      const manualPublicationDeadline = this.addHours(new Date(), manualTimeoutHours);

      const updated = await this.prisma.adOrder.update({
        where: { id: orderId },
        data: {
          status: AdOrderStatus.auto_publish_failed,
          autoPublishError: message,
          manualPublicationDeadline
        },
        include: this.orderInclude()
      });
      await this.logStatus(orderId, order.status, AdOrderStatus.auto_publish_failed, message);
      return updated;
    }
  }

  async autoConfirmPublication(orderId: string) {
    const order = await this.requireOrder(orderId);
    if (order.status !== AdOrderStatus.awaiting_advertiser_confirmation) {
      return order;
    }

    await this.setStatus(orderId, AdOrderStatus.approved_by_advertiser, "Auto-confirmed by advertiser timeout");
    return this.ledger.completeOrderDistribution(orderId);
  }

  async setStatus(orderId: string, status: AdOrderStatus, comment?: string) {
    const order = await this.requireOrder(orderId);
    const updated = await this.prisma.adOrder.update({
      where: { id: orderId },
      data: { status },
      include: this.orderInclude()
    });
    await this.logStatus(orderId, order.status, status, comment);
    return updated;
  }

  private async requireOrder(orderId: string) {
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
      include: {
        advertiserProfile: true,
        ownerProfile: true,
        channel: true,
        placementFormat: true
      }
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  private ensureOwnerAccess(order: { ownerProfile: { userId: string } }, ownerUserId?: string) {
    if (ownerUserId && order.ownerProfile.userId !== ownerUserId) {
      throw new BadRequestException("This order belongs to another owner");
    }
  }

  private async publishOrderToTelegram(order: {
    postText: string;
    mediaUrl: string | null;
    buttonText: string | null;
    buttonUrl: string | null;
    channel: {
      link: string;
      telegramChatId: string | null;
      publicationMode: PublicationMode;
      botCanPost: boolean;
      botCanPostMedia: boolean;
    };
  }) {
    const token = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const chatId = order.channel.telegramChatId || this.telegramChatIdFromLink(order.channel.link);
    if (!chatId) {
      throw new Error("Channel Telegram chat id could not be resolved from channel settings or public link");
    }

    const method = order.mediaUrl ? "sendPhoto" : "sendMessage";
    const payload: Record<string, unknown> = {
      chat_id: chatId
    };

    if (order.mediaUrl) {
      payload.photo = order.mediaUrl;
      payload.caption = order.postText;
    } else {
      payload.text = order.postText;
    }

    const replyMarkup = this.telegramReplyMarkup(order.buttonText, order.buttonUrl);
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; description?: string; result?: { message_id?: number } } | null;

    if (!response.ok || !result?.ok) {
      throw new Error(result?.description || `Telegram API request failed: ${response.status}`);
    }

    const messageId = result.result?.message_id;
    if (!messageId) {
      throw new Error("Telegram API response did not include message_id");
    }

    return this.buildTelegramPostUrl(order.channel.link, messageId);
  }

  private telegramReplyMarkup(buttonText?: string | null, buttonUrl?: string | null) {
    if (!buttonText?.trim() || !buttonUrl?.trim() || !this.isHttpUrl(buttonUrl)) {
      return null;
    }

    return {
      inline_keyboard: [
        [
          {
            text: buttonText.trim(),
            url: buttonUrl.trim()
          }
        ]
      ]
    };
  }

  private buildTelegramPostUrl(channelLink: string, messageId: number) {
    return `${channelLink.replace(/\/$/, "")}/${messageId}`;
  }

  private telegramChatIdFromLink(channelLink: string) {
    try {
      const url = new URL(channelLink);
      const host = url.hostname.replace(/^www\./, "");
      if (host !== "t.me" && host !== "telegram.me") {
        return null;
      }

      const [username] = url.pathname.split("/").filter(Boolean);
      if (!username || username === "c" || username === "joinchat" || username.startsWith("+")) {
        return null;
      }

      return `@${username}`;
    } catch {
      return null;
    }
  }

  private async logStatus(orderId: string, fromStatus: AdOrderStatus, toStatus: AdOrderStatus, comment?: string) {
    await this.prisma.adOrderStatusLog.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        comment
      }
    });
  }

  private async scheduleJob(action: () => Promise<unknown>, label: string) {
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown queue error";
      this.logger.warn(`Failed to schedule ${label}: ${message}`);
    }
  }

  private async getNumberSetting(key: string, fallback: number) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    return typeof setting?.value === "number" ? setting.value : fallback;
  }

  private async getBooleanSetting(key: string, fallback: boolean) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    return typeof setting?.value === "boolean" ? setting.value : fallback;
  }

  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private parseDate(value: string, errorMessage: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(errorMessage);
    }
    return date;
  }

  private isHttpUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  private isSameCalendarDate(left: Date, right: Date) {
    return (
      left.getUTCFullYear() === right.getUTCFullYear() &&
      left.getUTCMonth() === right.getUTCMonth() &&
      left.getUTCDate() === right.getUTCDate()
    );
  }

  private resolvePostType(input: Pick<CreateOrderInput, "mediaUrl" | "buttonText" | "buttonUrl">) {
    if (input.mediaUrl?.trim()) {
      return AdPostType.text_image;
    }

    if (input.buttonText?.trim() || input.buttonUrl?.trim()) {
      return AdPostType.text_button;
    }

    return AdPostType.text;
  }

  private orderInclude() {
    return {
      advertiserProfile: { include: { user: true } },
      ownerProfile: { include: { user: true } },
      channel: { include: { category: true } },
      placementFormat: true,
      statusHistory: { orderBy: { createdAt: "asc" } }
    } as const;
  }
}
