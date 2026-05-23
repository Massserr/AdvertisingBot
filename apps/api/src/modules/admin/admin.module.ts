import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [FinanceModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
