import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../../../infrastructure/redis/redis.module';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

const CHALLENGE_TTL = 300; // 5 minutes
const CHALLENGE_PREFIX = 'passkey:challenge:';

// WebAuthn transport values — avoids importing from lib.dom which may not be in scope
type Transport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

@Injectable()
export class PasskeyService {
  private readonly rpName = 'Hammad Afzal Portfolio';
  private readonly rpID: string;
  private readonly origin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.rpID   = this.config.get<string>('RP_ID')     ?? 'localhost';
    this.origin = this.config.get<string>('RP_ORIGIN') ?? 'http://localhost:3000';
  }

  // ── Registration ──────────────────────────────────────────────────────────

  async beginRegistration() {
    const existingCredentials = await this.prisma.passkeyCredential.findMany({
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new TextEncoder().encode('admin'),
      userName: this.config.get<string>('ADMIN_EMAIL') ?? 'admin',
      userDisplayName: 'Hammad Afzal — Admin',
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as Transport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.redis.setex(`${CHALLENGE_PREFIX}register`, CHALLENGE_TTL, options.challenge);
    return options;
  }

  async finishRegistration(response: RegistrationResponseJSON, deviceName: string) {
    const expectedChallenge = await this.redis.get(`${CHALLENGE_PREFIX}register`);
    if (!expectedChallenge) {
      throw new UnauthorizedException('Registration challenge expired or not found');
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: true,
      });
    } catch (err) {
      throw new UnauthorizedException(`Registration verification failed: ${String(err)}`);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Registration not verified');
    }

    const { credential } = verification.registrationInfo;

    await this.redis.del(`${CHALLENGE_PREFIX}register`);

    await this.prisma.passkeyCredential.create({
      data: {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: (response.response.transports ?? []) as string[],
        deviceName: deviceName || 'Unknown device',
      },
    });

    return { verified: true };
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  async beginAuthentication() {
    const credentials = await this.prisma.passkeyCredential.findMany({
      select: { credentialId: true, transports: true },
    });

    if (credentials.length === 0) {
      throw new UnauthorizedException('No passkeys registered. Use password login to register one first.');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as Transport[],
      })),
      userVerification: 'preferred',
    });

    await this.redis.setex(`${CHALLENGE_PREFIX}auth`, CHALLENGE_TTL, options.challenge);
    return options;
  }

  async finishAuthentication(response: AuthenticationResponseJSON) {
    const expectedChallenge = await this.redis.get(`${CHALLENGE_PREFIX}auth`);
    if (!expectedChallenge) {
      throw new UnauthorizedException('Authentication challenge expired or not found');
    }

    const credential = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: response.id },
    });

    if (!credential) {
      throw new UnauthorizedException('Passkey not found');
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: credential.credentialId,
          publicKey: new Uint8Array(credential.publicKey),
          counter: Number(credential.counter),
          transports: credential.transports as Transport[],
        },
        requireUserVerification: true,
      });
    } catch (err) {
      throw new UnauthorizedException(`Authentication verification failed: ${String(err)}`);
    }

    if (!verification.verified) {
      throw new UnauthorizedException('Authentication not verified');
    }

    await this.prisma.passkeyCredential.update({
      where: { credentialId: response.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    await this.redis.del(`${CHALLENGE_PREFIX}auth`);

    const adminEmail = this.config.get<string>('ADMIN_EMAIL') ?? 'admin';
    const access_token = this.jwtService.sign({ sub: adminEmail, email: adminEmail });
    return { access_token };
  }

  // ── Credential management ──────────────────────────────────────────────────

  async listCredentials() {
    return this.prisma.passkeyCredential.findMany({
      select: {
        id: true,
        credentialId: true,
        deviceName: true,
        createdAt: true,
        lastUsedAt: true,
        transports: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async deleteCredential(id: string) {
    await this.prisma.passkeyCredential.delete({ where: { id } });
  }
}
