import { forwardRef, Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { JobsModule } from "../jobs/jobs.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [FinanceModule, forwardRef(() => JobsModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
