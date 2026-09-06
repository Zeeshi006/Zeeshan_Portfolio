import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Allow, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { PasskeyService } from '../../application/services/passkey.service';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

class FinishRegistrationDto {
  // @Allow() whitelists the field without validating nested properties —
  // simplewebauthn validates the internals; we just need it to survive the global ValidationPipe
  @ApiProperty()
  @Allow()
  response!: RegistrationResponseJSON;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceName?: string;
}

class FinishAuthenticationDto {
  @ApiProperty()
  @Allow()
  response!: AuthenticationResponseJSON;
}

@ApiTags('auth/passkey')
@Controller('auth/passkey')
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @Post('register/begin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate WebAuthn registration options (requires existing JWT)' })
  beginRegistration() {
    return this.passkeyService.beginRegistration();
  }

  @Post('register/finish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify registration response and store credential' })
  finishRegistration(@Body() dto: FinishRegistrationDto) {
    return this.passkeyService.finishRegistration(dto.response, dto.deviceName ?? 'Unknown device');
  }

  @Post('login/begin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Generate WebAuthn authentication options (public)' })
  beginAuthentication() {
    return this.passkeyService.beginAuthentication();
  }

  @Post('login/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify authentication response and return JWT' })
  finishAuthentication(@Body() dto: FinishAuthenticationDto) {
    return this.passkeyService.finishAuthentication(dto.response);
  }

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered passkeys' })
  listCredentials() {
    return this.passkeyService.listCredentials();
  }

  @Delete('credentials/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a registered passkey' })
  deleteCredential(@Param('id') id: string) {
    return this.passkeyService.deleteCredential(id);
  }
}
