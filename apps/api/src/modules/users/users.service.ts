import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAdvertiserProfile(userId: string, input: { name: string; description?: string }) {
    const user = await this.requireUser(userId);
    const roles = new Set(user.roles);
    roles.add(UserRole.advertiser);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: [...roles],
        currentRole: UserRole.advertiser,
        advertiserProfile: {
          upsert: {
            update: input,
            create: input
          }
        }
      },
      include: { advertiserProfile: true, ownerProfile: true }
    });
  }

  async ensureOwnerProfile(userId: string, input: { name: string; description?: string }) {
    const user = await this.requireUser(userId);
    const roles = new Set(user.roles);
    roles.add(UserRole.owner);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: [...roles],
        currentRole: UserRole.owner,
        ownerProfile: {
          upsert: {
            update: input,
            create: input
          }
        }
      },
      include: { advertiserProfile: true, ownerProfile: true }
    });
  }

  async switchCurrentRole(userId: string, role: UserRole) {
    const user = await this.requireUser(userId);
    if (!user.roles.includes(role)) {
      throw new BadRequestException("Role is not available for this user");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { currentRole: role }
    });
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
