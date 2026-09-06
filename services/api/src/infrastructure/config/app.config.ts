import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  port: parseInt(process.env["API_PORT"] ?? "3001", 10),
  databaseUrl: process.env["DATABASE_URL"] ?? "",
  redisUrl: process.env["REDIS_URL"] ?? "redis://localhost:6379",
  jwtSecret: process.env["JWT_SECRET"],
  allowedOrigins: process.env["ALLOWED_ORIGINS"]?.split(",") ?? ["http://localhost:3000"],
}));

// Note: OPENROUTER_API_KEY, RESEND_API_KEY, ADMIN_EMAIL, GITHUB_TOKEN etc.
// are accessed directly via ConfigService.get("KEY") — not namespaced under "app".
