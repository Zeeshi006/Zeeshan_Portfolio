import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Inject } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../../infrastructure/redis/redis.module";

@WebSocketGateway({
  cors: {
    origin: process.env["ALLOWED_ORIGINS"]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
    credentials: true,
  },
  namespace: "/online",
})
export class OnlineGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly connectedIds = new Set<string>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  handleConnection(client: Socket): void {
    this.connectedIds.add(client.id);
    this.broadcast();
  }

  handleDisconnect(client: Socket): void {
    this.connectedIds.delete(client.id);
    this.broadcast();
  }

  @SubscribeMessage("ping")
  handlePing(): { count: number } {
    return { count: this.connectedIds.size };
  }

  private broadcast(): void {
    const count = this.connectedIds.size;
    this.server.emit("count", { count });
    // Persist for the metrics collector — fire-and-forget
    void this.redis.set("visitors:online", count);
  }
}
