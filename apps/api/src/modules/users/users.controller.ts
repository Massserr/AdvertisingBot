import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(":id")
  getUser(@Param("id") userId: string) {
    return this.users.getUser(userId);
  }

  @Post(":id/profiles/advertiser")
  createAdvertiserProfile(@Param("id") userId: string, @Body() body: { name: string; description?: string }) {
    return this.users.ensureAdvertiserProfile(userId, body);
  }

  @Post(":id/profiles/owner")
  createOwnerProfile(@Param("id") userId: string, @Body() body: { name: string; description?: string }) {
    return this.users.ensureOwnerProfile(userId, body);
  }

  @Patch(":id/current-role")
  switchRole(@Param("id") userId: string, @Body("role") role: UserRole) {
    return this.users.switchCurrentRole(userId, role);
  }
}
