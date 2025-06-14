import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { UsersService } from '../users/users.service';
import { parse } from 'cookie';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserDocument } from '../users/schemas/user.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { GroupsService } from '../groups/groups.service';
import { EncryptionService } from '../common/services/encryption.service';

interface JwtPayload {
  sub: string;
  email: string;
}

interface AuthenticatedSocket extends Socket {
  user: UserDocument;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatsGateway.name);

  constructor(
    private readonly chatsService: ChatsService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly groupsService: GroupsService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = this.extractJwtFromSocket(socket);
      if (!token) {
        throw new Error('No token found');
      }

      const payload: JwtPayload = this.jwtService.verify(token);
      if (!payload) {
        throw new Error('Invalid token');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }

      socket.user = user;
      this.logger.log(`Client connected: ${socket.id}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Connection failed', error.message);
      } else {
        this.logger.error('Connection failed', error);
      }
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('groupId') groupId: string,
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    socket.join(groupId);
    this.logger.log(`Client ${socket.id} joined room ${groupId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() sendMessageDto: SendMessageDto,
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    const { groupId, content } = sendMessageDto;
    const userId = socket.user._id.toString();

    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === userId,
    );
    if (!isMember) {
      throw new UnauthorizedException('You are not a member of this group');
    }

    const encryptedContent = this.encryptionService.encrypt(content);

    const message = await this.chatsService.createMessage(
      encryptedContent,
      userId,
      groupId,
    );

    const decryptedMessage = {
      ...message.toObject(),
      content: this.encryptionService.decrypt(message.content),
    };

    this.server.to(groupId).emit('newMessage', decryptedMessage);
  }

  private extractJwtFromSocket(socket: Socket): string | null {
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    const cookies = socket.handshake.headers.cookie;
    if (cookies) {
      const parsedCookies = parse(cookies);
      if (parsedCookies.access_token) {
        return parsedCookies.access_token;
      }
    }

    return null;
  }
}
