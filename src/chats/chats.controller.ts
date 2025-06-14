import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ChatsService } from './chats.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { EncryptionService } from 'src/common/services/encryption.service';
import { GroupsService } from 'src/groups/groups.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserDocument } from 'src/users/schemas/user.schema';

interface AuthenticatedRequest {
  user: UserDocument;
}

@ApiTags('Chats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly groupsService: GroupsService,
    private readonly encryptionService: EncryptionService,
  ) {}

  @Get(':groupId/messages')
  @ApiOperation({ summary: 'Get all messages for a specific group' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiResponse({
    status: 200,
    description: 'An array of messages for the group.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User is not a member of the group.',
  })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  async getMessages(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === req.user._id.toString(),
    );
    if (!isMember) {
      throw new ForbiddenException(
        'You are not a member of this group and cannot view messages.',
      );
    }

    const messages = await this.chatsService.getMessages(groupId);
    return messages.map((message) => {
      return {
        ...message.toObject(),
        content: this.encryptionService.decrypt(message.content),
      };
    });
  }
}
