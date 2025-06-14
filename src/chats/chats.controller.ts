import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EncryptionService } from '../common/services/encryption.service';
import { GroupsService } from 'src/groups/groups.service';
import { UnauthorizedException } from '@nestjs/common/exceptions';
import { Request } from '@nestjs/common';
import { UserDocument } from 'src/users/schemas/user.schema';

@Controller('groups/:id/messages')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly encryptionService: EncryptionService,
    private readonly groupsService: GroupsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getMessages(
    @Param('id') groupId: string,
    @Request() req: { user: UserDocument },
  ) {
    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === req.user._id.toString(),
    );
    if (!isMember) {
      throw new UnauthorizedException('You are not a member of this group');
    }

    const messages = await this.chatsService.getMessages(groupId);
    return messages.map((message) => ({
      ...message.toObject(),
      content: this.encryptionService.decrypt(message.content),
    }));
  }
}
