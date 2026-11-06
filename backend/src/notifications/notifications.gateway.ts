import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

interface AccessTokenPayload {
  sub: string;
  exp: number;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length > 4096) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
      if (!payload.sub || !payload.exp) {
        client.disconnect(true);
        return;
      }

      await client.join(`user:${payload.sub}`);
      client.data.userId = payload.sub;
      client.data.expirationTimer = setTimeout(
        () => client.disconnect(true),
        Math.max(0, payload.exp * 1000 - Date.now()),
      );
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const expirationTimer = client.data.expirationTimer;
    if (expirationTimer) {
      clearTimeout(expirationTimer);
    }
  }

  emitNewNotification(userId: string): void {
    this.server.to(`user:${userId}`).emit('notification:new');
  }
}
