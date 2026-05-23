import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { PublicationMode } from "@prisma/client";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("channels")
  listChannels(
    @Query("categoryId") categoryId?: string,
    @Query("publicationMode") publicationMode?: PublicationMode,
    @Query("sort") sort?: "subscribers" | "price" | "created"
  ) {
    return this.catalog.listVerifiedChannels({ categoryId, publicationMode, sort });
  }

  @Post("channels")
  createChannel(@Body() body: Parameters<CatalogService["createChannel"]>[0]) {
    return this.catalog.createChannel(body);
  }
}
