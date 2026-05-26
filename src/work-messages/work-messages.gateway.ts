import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma';
import { WorkMessagesService } from './work-messages.service';

interface AuthSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class WorkMessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly workMessagesService: WorkMessagesService,
  ) {}

  async handleConnection(client: AuthSocket): Promise<void> {
    const token =
      (client.handshake.auth as Record<string, string>)['token'] ??
      (client.handshake.headers['authorization'] ?? '').replace('Bearer ', '');
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET,
      });
      client.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthSocket): void {
    // cleanup if needed
  }

  @SubscribeMessage('joinWork')
  async handleJoin(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() workId: string,
  ): Promise<void> {
    if (!client.userId) return;
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) return;
    if (work.authorId !== client.userId && work.supervisorId !== client.userId) return;
    await client.join(`work:${workId}`);
    client.emit('joined', { workId });
  }

  @SubscribeMessage('leaveWork')
  async handleLeave(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() workId: string,
  ): Promise<void> {
    await client.leave(`work:${workId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { workId: string; text: string; fileId?: string },
  ): Promise<void> {
    if (!client.userId || !data.text?.trim()) return;
    try {
      const msg = await this.workMessagesService.sendMessage(
        data.workId,
        client.userId,
        data.text.trim(),
        data.fileId,
      );
      this.server.to(`work:${data.workId}`).emit('newMessage', msg);
    } catch {
      client.emit('error', { message: 'Не удалось отправить сообщение' });
    }
  }
}
