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
import { Logger } from '@nestjs/common';
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
    credentials: true,
  },
  transports: ['websocket'],
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
    this.logger.log(`New connection attempt: ${socket.id}`);

    try {
      // Extract token from different possible locations
      let token: string | undefined;

      // 1. Check Authorization header
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }

      // 2. Check query parameters as fallback
      if (!token && socket.handshake.query.token) {
        token = Array.isArray(socket.handshake.query.token)
          ? socket.handshake.query.token[0]
          : socket.handshake.query.token;
      }

      // 3. Check auth object in handshake
      if (!token && socket.handshake.auth) {
        const auth = socket.handshake.auth as Record<string, unknown>;
        if (auth.token && typeof auth.token === 'string') {
          token = auth.token;
        }
      }

      if (!token) {
        this.logger.warn(
          `Connection rejected - No authorization token found: ${socket.id}`,
        );
        socket.emit('error', { message: 'No authorization token found' });
        socket.disconnect(true);
        return;
      }

      this.logger.debug(`Verifying token for socket: ${socket.id}`);
      const payload: JwtPayload = await this.jwtService.verifyAsync(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        this.logger.warn(
          `Connection rejected - User not found: ${payload.sub}`,
        );
        socket.emit('error', { message: 'User not found' });
        socket.disconnect(true);
        return;
      }

      socket.user = user;
      this.logger.log(
        `Client connected successfully: ${socket.id}, User ID: ${socket.user._id.toString()}, Email: ${socket.user.email}`,
      );

      // Send confirmation to client
      socket.emit('connected', {
        message: 'Connected successfully',
        userId: socket.user._id.toString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection failed for ${socket.id}: ${message}`);
      socket.emit('error', { message: 'Authentication failed: ' + message });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.user) {
      this.logger.log(
        `Client disconnected: ${socket.id}, User ID: ${socket.user._id.toString()}`,
      );
    } else {
      this.logger.log(`Client disconnected: ${socket.id} (unauthenticated)`);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId: string },
  ): Promise<void> {
    const userId = client.user._id.toString();
    const { groupId } = data;

    this.logger.log(
      `User ${userId} attempting to join room for group ${groupId}`,
    );

    try {
      const group = await this.groupsService.findById(groupId);

      if (!group) {
        this.logger.warn(`Group not found: ${groupId}`);
        client.emit('error', { message: 'Group not found' });
        return;
      }

      const isMember = group.members.some(
        (member: UserDocument) => member._id.toString() === userId,
      );

      if (!isMember) {
        this.logger.warn(
          `User ${userId} failed to join room for group ${groupId} (not a member).`,
        );
        client.emit('error', {
          message: 'You are not authorized to join this room.',
        });
        return;
      }

      client.join(groupId);
      client.emit('joinedRoom', {
        groupId,
        message: 'Successfully joined room',
      });
      this.server.to(groupId).emit('userJoined', { userId, groupId });
      this.logger.log(`User ${userId} joined room for group ${groupId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error joining room: ${message}`);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { groupId: string },
  ): void {
    const userId = client.user._id.toString();
    const { groupId } = data;

    this.logger.log(
      `User ${userId} attempting to leave room for group ${groupId}`,
    );

    try {
      client.leave(groupId);
      client.emit('leftRoom', { groupId, message: 'Successfully left room' });
      this.server.to(groupId).emit('userLeft', { userId, groupId });
      this.logger.log(`User ${userId} left room for group ${groupId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error leaving room: ${message}`);
      client.emit('error', { message: 'Failed to leave room' });
    }
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

    try {
      const group = await this.groupsService.findById(groupId);
      if (!group) {
        this.logger.error(
          `Message send failed: Group with ID ${groupId} not found.`,
        );
        client.emit('error', { message: 'Group not found.' });
        return;
      }

      const isMember = group.members.some(
        (member) => member._id.toString() === senderId,
      );
      if (!isMember) {
        this.logger.warn(
          `Non-member ${senderId} attempted to send message to group ${groupId}.`,
        );
        client.emit('error', {
          message: 'You are not a member of this group.',
        });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error sending message: ${message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }
}
