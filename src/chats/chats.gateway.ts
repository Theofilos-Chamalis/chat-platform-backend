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
  transports: ['websocket'],
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
    private readonly groupsService: GroupsService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('No authorization token found');
      }
      const payload: JwtPayload = await this.jwtService.verifyAsync(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      socket.user = user;
      this.logger.log(
        `Client connected: ${socket.id}, User ID: ${socket.user._id.toString()}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection failed: ${message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.user) {
      this.logger.log(
        `Client disconnected: ${
          socket.id
        }, User ID: ${socket.user._id.toString()}`,
      );
    } else {
      this.logger.log(`Client disconnected: ${socket.id}`);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody('groupId') groupId: string,
  ): Promise<void> {
    const userId = client.user._id.toString();
    this.logger.log(
      `User ${userId} attempting to join room for group ${groupId}`,
    );

    const group = await this.groupsService.findById(groupId);
    const isMember = group?.members.some(
      (member: UserDocument) => member._id.toString() === userId,
    );

    if (!isMember) {
      this.logger.warn(
        `User ${userId} failed to join room for group ${groupId} (not a member).`,
      );
      client.emit('error', 'You are not authorized to join this room.');
      return;
    }

    client.join(groupId);
    this.server.to(groupId).emit('userJoined', { userId, groupId });
    this.logger.log(`User ${userId} joined room for group ${groupId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody('groupId') groupId: string,
  ): void {
    const userId = client.user._id.toString();
    this.logger.log(
      `User ${userId} attempting to leave room for group ${groupId}`,
    );
    client.leave(groupId);
    this.server.to(groupId).emit('userLeft', { userId, groupId });
    this.logger.log(`User ${userId} left room for group ${groupId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ): Promise<void> {
    const senderId = client.user._id.toString();
    const { groupId, content } = sendMessageDto;

    this.logger.debug(
      `User ${senderId} sending message to group ${groupId}: "${content}"`,
    );

    const group = await this.groupsService.findById(groupId);
    if (!group) {
      this.logger.error(
        `Message send failed: Group with ID ${groupId} not found.`,
      );
      client.emit('error', 'Group not found.');
      return;
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === senderId,
    );
    if (!isMember) {
      this.logger.warn(
        `Non-member ${senderId} attempted to send message to group ${groupId}.`,
      );
      client.emit('error', 'You are not a member of this group.');
      return;
    }

    const encryptedContent = this.encryptionService.encrypt(content);

    const message = await this.chatsService.createMessage(
      { groupId, content: encryptedContent },
      senderId,
    );

    const populatedMessage = await message.populate('sender');

    this.server.to(groupId).emit('newMessage', {
      ...populatedMessage.toObject(),
      content: this.encryptionService.decrypt(populatedMessage.content),
    });

    this.logger.log(
      `Message from ${senderId} broadcasted to group ${groupId}.`,
    );
  }
}
