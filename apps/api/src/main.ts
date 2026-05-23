import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const allowedOrigins = [config.get<string>("MINI_APP_URL"), config.get<string>("ADMIN_APP_URL")].filter(
    (origin): origin is string => Boolean(origin)
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(config.get<number>("API_PORT", 4000));
}

void bootstrap();
