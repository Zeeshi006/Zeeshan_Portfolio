import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import type { Redis } from "ioredis";
import { JwtAuthGuard } from "../auth/infrastructure/guards/jwt-auth.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { REDIS_CLIENT } from "../../infrastructure/redis/redis.module";
import { CollectEventDto } from "./dto/collect.dto";


// ---- response shapes -------------------------------------------------------

interface DayStat {
  date: string;
  count: number;
}

interface PathStat {
  path: string;
  count: number;
}

interface AnalyticsSummary {
  totalPageViews: number;
  uniqueSessions: number;
  topPaths: PathStat[];
  eventsByDay: DayStat[];
  chatbotOpens: number;
  caseStudyReads: number;
}

interface PaginatedEvents {
  data: unknown[];
  total: number;
}

// Raw query row shapes
interface DayRow {
  date: Date | string;
  count: bigint | number;
}

interface PathRow {
  path: string;
  count: bigint | number;
}

interface CountRow {
  count: bigint | number;
}

// ---------------------------------------------------------------------------

/** Geo response from ip-api.com */
interface GeoApiResponse {
  status: string;
  country?: string;
  regionName?: string;
  city?: string;
}

interface GeoData {
  country: string;
  region: string;
  city: string;
}

/** Returns true for loopback and private-range IPs — no geo lookup needed. */
function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "unknown") return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

/** Derive a cache key from the first 3 octets of an IPv4 address, or the full IPv6. */
function geoCacheKey(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `geo:${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return `geo:${ip}`;
}

@ApiTags("analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // -------------------------------------------------------------------------
  // Geo lookup helper (Redis-cached, subnet-level key)
  // -------------------------------------------------------------------------

  private async geoLookup(ip: string): Promise<GeoData | null> {
    if (isPrivateIp(ip)) return null;

    const cacheKey = geoCacheKey(ip);

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return JSON.parse(cached) as GeoData;
      }
    } catch {
      // Redis unavailable — fall through to live lookup
    }

    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city,status`);
      const body = (await response.json()) as GeoApiResponse;

      if (body.status !== "success") return null;

      const geo: GeoData = {
        country: body.country ?? "",
        region: body.regionName ?? "",
        city: body.city ?? "",
      };

      try {
        await this.redis.set(cacheKey, JSON.stringify(geo), "EX", 86400);
      } catch {
        // Cache write failure is non-fatal
      }

      return geo;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // POST /analytics/collect  (public, rate-limited by IP)
  // -------------------------------------------------------------------------

  @Post("collect")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Ingest an analytics event (public, 100 req/min per IP)" })
  @ApiResponse({ status: 204, description: "Event recorded." })
  @ApiResponse({ status: 400, description: "Rate limit exceeded or validation error." })
  async collect(
    @Body() dto: CollectEventDto,
    @Req() req: Request,
  ): Promise<void> {
    // req.ip is correctly populated from X-Forwarded-For when trust proxy is configured in main.ts
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    const geo = await this.geoLookup(ip);

    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(geo ?? {}),
      ua: (req.headers["user-agent"] ?? "").slice(0, 120),
    };

    await this.prisma.analyticsEvent.create({
      data: {
        type: dto.type,
        path: dto.path,
        section: dto.section,
        sessionId: dto.sessionId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  // -------------------------------------------------------------------------
  // GET /analytics/total-views  (public)
  // -------------------------------------------------------------------------

  @Get("total-views")
  @ApiOperation({ summary: "All-time page view count (public, Redis-cached 5 min)" })
  @ApiResponse({ status: 200, description: "{ total: number }" })
  async totalViews(): Promise<{ total: number }> {
    const CACHE_KEY = "analytics:total_page_views";
    const CACHE_TTL = 300; // 5 minutes

    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached !== null) return { total: parseInt(cached, 10) };
    } catch {
      // Redis unavailable — fall through to DB
    }

    const total = await this.prisma.analyticsEvent.count({
      where: { type: "page_view" },
    });

    try {
      await this.redis.set(CACHE_KEY, String(total), "EX", CACHE_TTL);
    } catch {
      // Cache write failure is non-fatal
    }

    return { total };
  }

  // -------------------------------------------------------------------------
  // GET /analytics/summary  (admin-only)
  // -------------------------------------------------------------------------

  @Get("summary")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Aggregated analytics summary (admin only)" })
  @ApiResponse({ status: 200, description: "Summary statistics." })
  async summary(): Promise<AnalyticsSummary> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Total page views (last 30 days)
    const [pvRow] = await this.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM analytics_events
      WHERE type = 'page_view'
        AND "createdAt" >= ${thirtyDaysAgo}
    `;

    // Unique sessions (last 30 days)
    const [sessRow] = await this.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "sessionId")::int AS count
      FROM analytics_events
      WHERE "createdAt" >= ${thirtyDaysAgo}
    `;

    // Top 10 paths by page_view count (last 30 days)
    const pathRows = await this.prisma.$queryRaw<PathRow[]>`
      SELECT path, COUNT(*)::int AS count
      FROM analytics_events
      WHERE type = 'page_view'
        AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY path
      ORDER BY count DESC
      LIMIT 10
    `;

    // Events by day (last 14 days) — all event types
    const dayRows = await this.prisma.$queryRaw<DayRow[]>`
      SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
      FROM analytics_events
      WHERE "createdAt" >= ${fourteenDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Chatbot opens (last 30 days)
    const [chatRow] = await this.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM analytics_events
      WHERE type = 'chatbot_open'
        AND "createdAt" >= ${thirtyDaysAgo}
    `;

    // Case study reads (last 30 days)
    const [caseRow] = await this.prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM analytics_events
      WHERE type = 'case_study_read'
        AND "createdAt" >= ${thirtyDaysAgo}
    `;

    return {
      totalPageViews: Number(pvRow?.count ?? 0),
      uniqueSessions: Number(sessRow?.count ?? 0),
      topPaths: pathRows.map((r) => ({
        path: r.path,
        count: Number(r.count),
      })),
      eventsByDay: dayRows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().split("T")[0]! : String(r.date),
        count: Number(r.count),
      })),
      chatbotOpens: Number(chatRow?.count ?? 0),
      caseStudyReads: Number(caseRow?.count ?? 0),
    };
  }

  // -------------------------------------------------------------------------
  // GET /analytics/events  (admin-only, paginated)
  // -------------------------------------------------------------------------

  @Get("events")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Paginated list of raw analytics events (admin only)" })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "limit", required: false, example: 50 })
  @ApiResponse({ status: 200, description: "Paginated events list." })
  async events(
    @Query("page") page = "1",
    @Query("limit") limit = "50",
  ): Promise<PaginatedEvents> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.analyticsEvent.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      this.prisma.analyticsEvent.count(),
    ]);

    return { data, total };
  }
}
