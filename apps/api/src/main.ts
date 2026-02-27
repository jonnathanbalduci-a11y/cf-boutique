import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: "15mb" }));
  app.use(urlencoded({ extended: true, limit: "15mb" }));

  app.enableCors({
    origin: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  console.log(`API rodando em: http://localhost:${port}`);
}

bootstrap();
