import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PublicationMode } from "@prisma/client";
import { CatalogService, ChannelSort, CreateChannelInput } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get("formats")
  listPlacementFormats() {
    return this.catalog.listPlacementFormats();
  }

  @Get("channels")
  listChannels(
    @Query("categoryId") categoryId?: string,
    @Query("publicationMode") publicationMode?: PublicationMode,
    @Query("sort") sort?: ChannelSort,
    @Query("minSubscribers") minSubscribers?: string,
    @Query("maxSubscribers") maxSubscribers?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string
  ) {
    return this.catalog.listVerifiedChannels({
      categoryId,
      publicationMode,
      sort,
      minSubscribers: this.parseOptionalNumber(minSubscribers),
      maxSubscribers: this.parseOptionalNumber(maxSubscribers),
      minPrice: this.parseOptionalNumber(minPrice),
      maxPrice: this.parseOptionalNumber(maxPrice)
    });
  }

  @Get("owners/:userId/channels")
  listOwnerChannels(@Param("userId") userId: string) {
    return this.catalog.listOwnerChannels(userId);
  }

  @Post("owners/:userId/channels")
  createOwnerChannel(@Param("userId") userId: string, @Body() body: CreateChannelInput) {
    return this.catalog.createChannelForUser(userId, body);
  }

  @Post("channels")
  createChannel(@Body() body: CreateChannelInput & { ownerProfileId: string }) {
    return this.catalog.createChannel(body);
  }

  private parseOptionalNumber(value?: string) {
    if (value === undefined || value === "") {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
