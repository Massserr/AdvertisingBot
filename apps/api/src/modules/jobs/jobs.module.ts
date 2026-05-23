import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NOTIFICATION_QUEUE, ORDER_QUEUE } from "./jobs.constants";
import { JobsService } from "./jobs.service";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config.get<string>("REDIS_URL", "redis://localhost:6379"))
      })
    }),
    BullModule.registerQueue({ name: ORDER_QUEUE }, { name: NOTIFICATION_QUEUE })
  ],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}

function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined
  };
}
