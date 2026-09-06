import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

export interface RequestEvent {
  method: string;
  path: string;
  status: number;
  ms: number;
  ts: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env['ALLOWED_ORIGINS']?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
    credentials: true,
  },
  namespace: '/metrics',
})
export class MetricsGateway {
  @WebSocketServer() server!: Server;

  emitRequest(event: RequestEvent): void {
    this.server.emit('request', event);
  }
}
