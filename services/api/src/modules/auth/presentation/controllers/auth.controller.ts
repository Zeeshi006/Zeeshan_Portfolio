import { Body, Controller, Post, HttpCode, HttpStatus } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiOkResponse, ApiTags, ApiTooManyRequestsResponse } from "@nestjs/swagger";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { LoginDto, TokenResponseDto } from "../dtos/auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  // 5 attempts per 60 s per IP — overrides global throttler
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiTooManyRequestsResponse({ description: "Too many login attempts — wait 60 s" })
  login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.loginUseCase.execute(dto.email, dto.password);
  }
}
