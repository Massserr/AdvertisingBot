import { Module } from "@nestjs/common";
import { FinanceController } from "./finance.controller";
import { LedgerService } from "./ledger.service";
import { PaymentsService } from "./payments.service";
import { PayoutsService } from "./payouts.service";

@Module({
  controllers: [FinanceController],
  providers: [LedgerService, PaymentsService, PayoutsService],
  exports: [LedgerService, PaymentsService, PayoutsService]
})
export class FinanceModule {}
