import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { TelegramAuthService } from "./telegram-auth.service";

@Module({
  controllers: [AuthController],
  providers: [TelegramAuthService],
  exports: [TelegramAuthService]
})
export class AuthModule {}
