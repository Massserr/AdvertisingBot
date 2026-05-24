import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ChannelStatus, Prisma, PublicationMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type ChannelSort = "subscribers" | "price" | "created";

export type CreateChannelInput = {
  categoryId: string;
  title: string;
  link: string;
  description?: string;
  subscribersCount?: number;
  publicationMode?: PublicationMode;
  prices: Array<{ placementFormatId: string; price: string | number; currency?: string; isEnabled?: boolean }>;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(options: { includeHidden?: boolean } = {}) {
    return this.prisma.category.findMany({
      where: options.includeHidden ? undefined : { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  listPlacementFormats(options: { includeInactive?: boolean } = {}) {
    return this.prisma.placementFormat.findMany({
      where: options.includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async listVerifiedChannels(filters: {
    categoryId?: string;
    publicationMode?: PublicationMode;
    sort?: ChannelSort;
    minSubscribers?: number;
    maxSubscribers?: number;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const channels = await this.prisma.channel.findMany({
      where: {
        status: ChannelStatus.verified,
        categoryId: filters.categoryId,
        publicationMode: filters.publicationMode,
        subscribersCount: {
          gte: filters.minSubscribers,
          lte: filters.maxSubscribers
        },
        prices:
          filters.minPrice !== undefined || filters.maxPrice !== undefined
            ? {
                some: {
                  isEnabled: true,
                  price: {
                    gte: filters.minPrice,
                    lte: filters.maxPrice
                  }
                }
              }
            : undefined
      },
      include: this.channelInclude(),
      orderBy: this.channelOrderBy(filters.sort)
    });

    if (filters.sort !== "price") {
      return channels;
    }

    return channels.sort((a, b) => this.minEnabledPrice(a.prices) - this.minEnabledPrice(b.prices));
  }

  async listOwnerChannels(userId: string) {
    const ownerProfile = await this.prisma.ownerProfile.findUnique({ where: { userId } });
    if (!ownerProfile) {
      throw new NotFoundException("Owner profile not found");
    }

    return this.prisma.channel.findMany({
      where: { ownerProfileId: ownerProfile.id },
      include: this.channelInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async createChannelForUser(userId: string, input: CreateChannelInput) {
    const ownerProfile = await this.prisma.ownerProfile.findUnique({ where: { userId } });
    if (!ownerProfile) {
      throw new BadRequestException("Create an owner profile before adding channels");
    }

    return this.createChannel({ ...input, ownerProfileId: ownerProfile.id });
  }

  async createChannel(input: CreateChannelInput & { ownerProfileId: string }) {
    await this.validateChannelInput(input);

    return this.prisma.channel.create({
      data: {
        ownerProfileId: input.ownerProfileId,
        categoryId: input.categoryId,
        title: input.title.trim(),
        link: this.normalizeTelegramLink(input.link),
        description: input.description?.trim() || null,
        subscribersCount: input.subscribersCount ?? 0,
        publicationMode: input.publicationMode ?? PublicationMode.manual,
        status: ChannelStatus.pending_verification,
        prices: {
          create: input.prices.map((price) => ({
            placementFormatId: price.placementFormatId,
            price: String(price.price),
            currency: price.currency ?? "RUB",
            isEnabled: price.isEnabled ?? true
          }))
        }
      },
      include: this.channelInclude()
    });
  }

  private async validateChannelInput(input: CreateChannelInput & { ownerProfileId?: string }) {
    if (!input.title?.trim()) {
      throw new BadRequestException("Channel title is required");
    }

    if (!input.link?.trim()) {
      throw new BadRequestException("Channel link is required");
    }

    if (input.subscribersCount !== undefined && input.subscribersCount < 0) {
      throw new BadRequestException("Subscribers count cannot be negative");
    }

    if (!input.prices?.length) {
      throw new BadRequestException("At least one placement price is required");
    }

    const enabledPrices = input.prices.filter((price) => price.isEnabled !== false);
    if (!enabledPrices.length) {
      throw new BadRequestException("At least one placement price must be enabled");
    }

    for (const price of enabledPrices) {
      if (!price.placementFormatId) {
        throw new BadRequestException("Placement format is required for each price");
      }

      const numericPrice = Number(price.price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new BadRequestException("Placement price must be greater than zero");
      }
    }

    const [category, activeFormats] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: input.categoryId } }),
      this.prisma.placementFormat.findMany({
        where: { id: { in: input.prices.map((price) => price.placementFormatId) }, isActive: true }
      })
    ]);

    if (!category || !category.isVisible) {
      throw new BadRequestException("Category is not available");
    }

    if (activeFormats.length !== new Set(input.prices.map((price) => price.placementFormatId)).size) {
      throw new BadRequestException("One or more placement formats are not available");
    }
  }

  private normalizeTelegramLink(link: string) {
    const trimmed = link.trim();
    if (trimmed.startsWith("https://t.me/") || trimmed.startsWith("http://t.me/")) {
      return trimmed.replace("http://", "https://");
    }

    if (trimmed.startsWith("@")) {
      return `https://t.me/${trimmed.slice(1)}`;
    }

    return trimmed;
  }

  private channelInclude() {
    return {
      category: true,
      ownerProfile: { include: { user: true } },
      prices: {
        include: { placementFormat: true },
        orderBy: { placementFormat: { sortOrder: "asc" } }
      }
    } satisfies Prisma.ChannelInclude;
  }

  private channelOrderBy(sort?: ChannelSort): Prisma.ChannelOrderByWithRelationInput {
    if (sort === "subscribers") {
      return { subscribersCount: "desc" };
    }

    return { createdAt: "desc" };
  }

  private minEnabledPrice(prices: Array<{ isEnabled: boolean; price: Prisma.Decimal }>) {
    const enabledPrices = prices.filter((price) => price.isEnabled).map((price) => price.price.toNumber());
    return enabledPrices.length ? Math.min(...enabledPrices) : Number.MAX_SAFE_INTEGER;
  }
}
