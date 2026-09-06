import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async execute(email: string, password: string): Promise<{ access_token: string }> {
    const adminEmail = this.config.get<string>("ADMIN_EMAIL");
    const adminHash = this.config.get<string>("ADMIN_PASSWORD_HASH");

    if (!adminEmail || !adminHash) {
      throw new UnauthorizedException("Admin credentials not configured");
    }

    if (email !== adminEmail) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, adminHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const token = this.jwtService.sign({ sub: email, email });
    return { access_token: token };
  }
}
