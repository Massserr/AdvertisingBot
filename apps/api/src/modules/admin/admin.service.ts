import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ChannelStatus, Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type AdminActorInput = {
  actorUserId?: string;
  comment?: string;
};

export type UpsertCategoryInput = AdminActorInput & {
  slug: string;
  name: string;
  description?: string | null;
  isVisible?: boolean;
  sortOrder?: number;
};

export type UpdateCategoryInput = AdminActorInput & Partial<Omit<UpsertCategoryInput, keyof AdminActorInput | "slug">>;

export type UpsertPlacementFormatInput = AdminActorInput & {
  code: string;
  name: string;
  description?: string | null;
  topHours: number;
  feedHours: number;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdatePlacementFormatInput = AdminActorInput &
  Partial<Omit<UpsertPlacementFormatInput, keyof AdminActorInput | "code">>;

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
              { lastName: { contains: search, mode: "insensitive" } },
              { telegramId: { contains: search } }
            ]
          }
        : undefined,
      include: { advertiserProfile: true, ownerProfile: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async setUserStatus(id: string, status: UserStatus, actor?: AdminActorInput) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException("User not found");
    }

    const after = await this.prisma.user.update({ where: { id }, data: { status } });
    await this.audit({
      actorUserId: actor?.actorUserId,
      action: "user.status_changed",
      entityType: "User",
      entityId: id,
      before,
      after,
      comment: actor?.comment
    });
    return after;
  }

  listChannels(status?: ChannelStatus) {
    return this.prisma.channel.findMany({
      where: { status },
      include: this.channelInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async setChannelStatus(id: string, status: ChannelStatus, actor?: AdminActorInput) {
    const before = await this.getChannelOrThrow(id);
    const after = await this.prisma.channel.update({
      where: { id },
      data: {
        status,
        verifiedAt: status === ChannelStatus.verified ? new Date() : null
      },
      include: this.channelInclude()
    });

    await this.audit({
      actorUserId: actor?.actorUserId,
      action: "channel.status_changed",
      entityType: "Channel",
      entityId: id,
      before,
      after,
      comment: actor?.comment
    });
    return after;
  }

  async setChannelCategory(id: string, categoryId: string, actor?: AdminActorInput) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new BadRequestException("Category not found");
    }

    const before = await this.getChannelOrThrow(id);
    const after = await this.prisma.channel.update({
      where: { id },
      data: { categoryId },
      include: this.channelInclude()
    });

    await this.audit({
      actorUserId: actor?.actorUserId,
      action: "channel.category_changed",
      entityType: "Channel",
      entityId: id,
      before,
      after,
      comment: actor?.comment
    });
    return after;
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  async createCategory(input: UpsertCategoryInput) {
    const category = await this.prisma.category.upsert({
      where: { slug: input.slug },
      update: {
        name: input.name,
        description: input.description,
        isVisible: input.isVisible ?? true,
        sortOrder: input.sortOrder ?? 0
      },
      create: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        isVisible: input.isVisible ?? true,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.audit({
      actorUserId: input.actorUserId,
      action: "category.upserted",
      entityType: "Category",
      entityId: category.id,
      after: category,
      comment: input.comment
    });
    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException("Category not found");
    }

    const after = await this.prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        isVisible: input.isVisible,
        sortOrder: input.sortOrder
      }
    });

    await this.audit({
      actorUserId: input.actorUserId,
      action: "category.updated",
      entityType: "Category",
      entityId: id,
      before,
      after,
      comment: input.comment
    });
    return after;
  }

  listPlacementFormats() {
    return this.prisma.placementFormat.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  async createPlacementFormat(input: UpsertPlacementFormatInput) {
    this.validateFormatDuration(input.topHours, input.feedHours);

    const format = await this.prisma.placementFormat.upsert({
      where: { code: input.code },
      update: {
        name: input.name,
        description: input.description,
        topHours: input.topHours,
        feedHours: input.feedHours,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0
      },
      create: {
        code: input.code,
        name: input.name,
        description: input.description,
        topHours: input.topHours,
        feedHours: input.feedHours,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0
      }
    });

    await this.audit({
      actorUserId: input.actorUserId,
      action: "placement_format.upserted",
      entityType: "PlacementFormat",
      entityId: format.id,
      after: format,
      comment: input.comment
    });
    return format;
  }

  async updatePlacementFormat(id: string, input: UpdatePlacementFormatInput) {
    const before = await this.prisma.placementFormat.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException("Placement format not found");
    }

    if (input.topHours !== undefined || input.feedHours !== undefined) {
      this.validateFormatDuration(input.topHours ?? before.topHours, input.feedHours ?? before.feedHours);
    }

    const after = await this.prisma.placementFormat.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        topHours: input.topHours,
        feedHours: input.feedHours,
        isActive: input.isActive,
        sortOrder: input.sortOrder
      }
    });

    await this.audit({
      actorUserId: input.actorUserId,
      action: "placement_format.updated",
      entityType: "PlacementFormat",
      entityId: id,
      before,
      after,
      comment: input.comment
    });
    return after;
  }

  upsertSetting(input: { key: string; value: Prisma.InputJsonValue; description?: string; updatedBy?: string }) {
    return this.prisma.platformSetting.upsert({
      where: { key: input.key },
      update: { value: input.value, description: input.description, updatedBy: input.updatedBy },
      create: input
    });
  }

  private async getChannelOrThrow(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id }, include: this.channelInclude() });
    if (!channel) {
      throw new NotFoundException("Channel not found");
    }
    return channel;
  }

  private channelInclude() {
    return {
      ownerProfile: { include: { user: true } },
      category: true,
      prices: { include: { placementFormat: true }, orderBy: { placementFormat: { sortOrder: "asc" } } }
    } satisfies Prisma.ChannelInclude;
  }

  private validateFormatDuration(topHours: number, feedHours: number) {
    if (!Number.isInteger(topHours) || topHours <= 0) {
      throw new BadRequestException("Top hours must be a positive integer");
    }

    if (!Number.isInteger(feedHours) || feedHours <= 0) {
      throw new BadRequestException("Feed hours must be a positive integer");
    }

    if (feedHours < topHours) {
      throw new BadRequestException("Feed hours cannot be less than top hours");
    }
  }

  private async audit(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    comment?: string;
  }) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before === undefined ? undefined : this.toJson(input.before),
        after: input.after === undefined ? undefined : this.toJson(input.after),
        comment: input.comment
      }
    });
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
