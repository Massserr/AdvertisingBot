import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ChannelStatus, Prisma, UserStatus } from "@prisma/client";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("users")
  listUsers(@Query("search") search?: string) {
    return this.admin.listUsers(search);
  }

  @Patch("users/:id/status")
  setUserStatus(@Param("id") id: string, @Body("status") status: UserStatus) {
    return this.admin.setUserStatus(id, status);
  }

  @Get("channels")
  listChannels(@Query("status") status?: ChannelStatus) {
    return this.admin.listChannels(status);
  }

  @Patch("channels/:id/status")
  setChannelStatus(@Param("id") id: string, @Body("status") status: ChannelStatus) {
    return this.admin.setChannelStatus(id, status);
  }

  @Post("settings")
  upsertSetting(@Body() body: { key: string; value: Prisma.InputJsonValue; description?: string; updatedBy?: string }) {
    return this.admin.upsertSetting(body);
  }
}
