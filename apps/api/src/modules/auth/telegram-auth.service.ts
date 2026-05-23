import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, createHash } from "crypto";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type TelegramInitUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

@Injectable()
export class TelegramAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async authenticateMiniApp(initData: string) {
    const user = this.verifyInitData(initData);

    return this.prisma.user.upsert({
      where: { telegramId: String(user.id) },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      },
      create: {
        telegramId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: []
      },
      include: {
        advertiserProfile: true,
        ownerProfile: true
      }
    });
  }

  verifyInitData(initData: string): TelegramInitUser {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new BadRequestException("Telegram bot token is not configured");
    }

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) {
      throw new UnauthorizedException("Telegram init data hash is missing");
    }

    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) {
      throw new UnauthorizedException("Telegram init data signature is invalid");
    }

    const authDate = Number(params.get("auth_date"));
    const maxAgeSeconds = 24 * 60 * 60;
    if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
      throw new UnauthorizedException("Telegram init data is expired");
    }

    const rawUser = params.get("user");
    if (!rawUser) {
      throw new UnauthorizedException("Telegram user payload is missing");
    }

    return JSON.parse(rawUser) as TelegramInitUser;
  }

  createLoginWidgetHash(data: Record<string, string>) {
    const botToken = this.config.getOrThrow<string>("TELEGRAM_BOT_TOKEN");
    const secret = createHash("sha256").update(botToken).digest();
    const dataCheckString = Object.entries(data)
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    return createHmac("sha256", secret).update(dataCheckString).digest("hex");
  }
}
