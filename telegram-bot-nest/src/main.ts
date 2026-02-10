import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config } from "dotenv";
import { AppModule } from "./app.module";

async function bootstrap() {
  config();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"]
  });
  app.enableShutdownHooks();
}

bootstrap();
