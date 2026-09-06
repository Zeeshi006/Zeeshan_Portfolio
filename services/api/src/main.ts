import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./infrastructure/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust exactly one proxy hop (nginx/Caddy in front of this process).
  // Enables req.ip to be populated from X-Forwarded-For safely.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  // Security headers — must come before CORS so preflight responses also get headers.
  app.use(
    helmet({
      // Swagger UI needs unsafe-inline for its own scripts; everything else is locked down.
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  const allowedOrigins = process.env["ALLOWED_ORIGINS"]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  // Fail closed in production if origins are not configured.
  if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    throw new Error("ALLOWED_ORIGINS must be set in production");
  }

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow same-server requests (no Origin header) and configured origins.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
      // Generic message — don't echo the rejected origin back to the caller.
      callback(new Error("CORS: origin not allowed"));
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Hammad Afzal — Portfolio API")
    .setDescription(
      "Clean-architecture NestJS backend powering the portfolio site. " +
        "All content, chatbot, analytics, and contact endpoints are documented here.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env["API_PORT"] ?? 3001;
  await app.listen(port);
  console.warn(`API running on http://localhost:${port}`);
  console.warn(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
