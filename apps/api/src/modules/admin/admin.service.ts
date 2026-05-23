import { Injectable } from "@nestjs/common";
import { ChannelStatus, Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(search?: string) {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } }
            ]
          }
        : undefined,
      include: { advertiserProfile: true, ownerProfile: true },
      orderBy: { createdAt: "desc" }
    });
  }

  setUserStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  listChannels(status?: ChannelStatus) {
    return this.prisma.channel.findMany({
      where: { status },
      include: { ownerProfile: { include: { user: true } }, category: true, prices: { include: { placementFormat: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  setChannelStatus(id: string, status: ChannelStatus) {
    return this.prisma.channel.update({
      where: { id },
      data: {
        status,
        verifiedAt: status === ChannelStatus.verified ? new Date() : undefined
      }
    });
  }

  upsertSetting(input: { key: string; value: Prisma.InputJsonValue; description?: string; updatedBy?: string }) {
    return this.prisma.platformSetting.upsert({
      where: { key: input.key },
      update: { value: input.value, description: input.description, updatedBy: input.updatedBy },
      create: input
    });
  }
}
