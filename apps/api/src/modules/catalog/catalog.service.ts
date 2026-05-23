import { Injectable } from "@nestjs/common";
import { ChannelStatus, Prisma, PublicationMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listVerifiedChannels(filters: {
    categoryId?: string;
    publicationMode?: PublicationMode;
    sort?: "subscribers" | "price" | "created";
  }) {
    const orderBy: Prisma.ChannelOrderByWithRelationInput =
      filters.sort === "subscribers"
        ? { subscribersCount: "desc" }
        : filters.sort === "created"
          ? { createdAt: "desc" }
          : { createdAt: "desc" };

    return this.prisma.channel.findMany({
      where: {
        status: ChannelStatus.verified,
        categoryId: filters.categoryId,
        publicationMode: filters.publicationMode
      },
      orderBy,
      include: {
        category: true,
        prices: { include: { placementFormat: true }, where: { isEnabled: true } }
      }
    });
  }

  createChannel(input: {
    ownerProfileId: string;
    categoryId: string;
    title: string;
    link: string;
    description?: string;
    subscribersCount?: number;
    publicationMode?: PublicationMode;
    prices: Array<{ placementFormatId: string; price: string; currency?: string }>;
  }) {
    return this.prisma.channel.create({
      data: {
        ownerProfileId: input.ownerProfileId,
        categoryId: input.categoryId,
        title: input.title,
        link: input.link,
        description: input.description,
        subscribersCount: input.subscribersCount ?? 0,
        publicationMode: input.publicationMode ?? PublicationMode.manual,
        status: ChannelStatus.pending_verification,
        prices: {
          create: input.prices.map((price) => ({
            placementFormatId: price.placementFormatId,
            price: price.price,
            currency: price.currency ?? "RUB"
          }))
        }
      },
      include: { prices: true }
    });
  }
}
