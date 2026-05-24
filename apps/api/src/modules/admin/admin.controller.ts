import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ChannelStatus, Prisma, UserStatus } from "@prisma/client";
import {
  AdminActorInput,
  AdminService,
  UpdateCategoryInput,
  UpdatePlacementFormatInput,
  UpsertCategoryInput,
  UpsertPlacementFormatInput
} from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("users")
  listUsers(@Query("search") search?: string) {
    return this.admin.listUsers(search);
  }

  @Patch("users/:id/status")
  setUserStatus(@Param("id") id: string, @Body() body: { status: UserStatus } & AdminActorInput) {
    return this.admin.setUserStatus(id, body.status, body);
  }

  @Get("channels")
  listChannels(@Query("status") status?: ChannelStatus) {
    return this.admin.listChannels(status);
  }

  @Patch("channels/:id/status")
  setChannelStatus(@Param("id") id: string, @Body() body: { status: ChannelStatus } & AdminActorInput) {
    return this.admin.setChannelStatus(id, body.status, body);
  }

  @Patch("channels/:id/category")
  setChannelCategory(@Param("id") id: string, @Body() body: { categoryId: string } & AdminActorInput) {
    return this.admin.setChannelCategory(id, body.categoryId, body);
  }

  @Get("categories")
  listCategories() {
    return this.admin.listCategories();
  }

  @Post("categories")
  createCategory(@Body() body: UpsertCategoryInput) {
    return this.admin.createCategory(body);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() body: UpdateCategoryInput) {
    return this.admin.updateCategory(id, body);
  }

  @Get("formats")
  listPlacementFormats() {
    return this.admin.listPlacementFormats();
  }

  @Post("formats")
  createPlacementFormat(@Body() body: UpsertPlacementFormatInput) {
    return this.admin.createPlacementFormat(body);
  }

  @Patch("formats/:id")
  updatePlacementFormat(@Param("id") id: string, @Body() body: UpdatePlacementFormatInput) {
    return this.admin.updatePlacementFormat(id, body);
  }

  @Post("settings")
  upsertSetting(@Body() body: { key: string; value: Prisma.InputJsonValue; description?: string; updatedBy?: string }) {
    return this.admin.upsertSetting(body);
  }
}
