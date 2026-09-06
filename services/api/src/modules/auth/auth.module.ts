import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./presentation/controllers/auth.controller";
import { PasskeyController } from "./presentation/controllers/passkey.controller";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { PasskeyService } from "./application/services/passkey.service";
import { JwtStrategy } from "./infrastructure/strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("app.jwtSecret");
        if (!secret) throw new Error("JWT_SECRET is not configured. Refusing to start.");
        return {
          secret,
          signOptions: { expiresIn: "2h", algorithm: "HS256" },
        };
      },
    }),
  ],
  controllers: [AuthController, PasskeyController],
  providers: [LoginUseCase, PasskeyService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
