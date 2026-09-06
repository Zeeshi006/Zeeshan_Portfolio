import { Body, Controller, Post, Logger } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength } from "class-validator";
import { Resend } from "resend";
import { PrismaService } from "../../infrastructure/database/prisma.service";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

class ContactDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MaxLength(2000) message!: string;
}

@ApiTags("contact")
@Controller("contact")
export class ContactController {
  private readonly logger = new Logger(ContactController.name);
  private readonly resend: Resend | null;
  private readonly notifyEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = config.get<string>("RESEND_API_KEY");
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.notifyEmail =
      config.get<string>("ADMIN_EMAIL") ?? "hammad.afzal.code@gmail.com";
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submit(@Body() dto: ContactDto): Promise<{ ok: boolean }> {
    // Persist to DB
    await this.prisma.analyticsEvent.create({
      data: {
        type: "contact_form",
        path: "/contact",
        sessionId: "server",
        metadata: { name: dto.name, email: dto.email, message: dto.message },
      },
    });

    // Send email notification if Resend is configured
    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: "Portfolio Contact <onboarding@resend.dev>",
          to: this.notifyEmail,
          replyTo: dto.email,
          subject: `Portfolio contact from ${dto.name}`,
          html: `
            <div style="font-family:monospace;max-width:600px;padding:24px;background:#0F1218;color:#E8ECF2;border-radius:8px">
              <h2 style="color:#C6FF3A;margin-top:0">New Portfolio Contact</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="color:#5C6573;padding:4px 0;width:80px">From</td><td style="color:#E8ECF2">${escHtml(dto.name)}</td></tr>
                <tr><td style="color:#5C6573;padding:4px 0">Email</td><td><a href="mailto:${escHtml(dto.email)}" style="color:#C6FF3A">${escHtml(dto.email)}</a></td></tr>
              </table>
              <hr style="border-color:#1E2430;margin:16px 0"/>
              <p style="color:#99A2B2;white-space:pre-wrap;margin:0">${escHtml(dto.message)}</p>
            </div>
          `,
        });
      } catch (err) {
        // Non-fatal — submission is already saved to DB
        this.logger.warn("Failed to send contact email notification", err);
      }
    } else {
      this.logger.warn(
        "RESEND_API_KEY not set — contact form submission saved to DB only",
      );
    }

    return { ok: true };
  }
}
