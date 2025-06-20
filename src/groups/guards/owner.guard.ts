import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GroupsService } from '../groups.service';
import { UserDocument } from 'src/users/schemas/user.schema';
import { Request } from 'express';
import { GroupDocument } from '../schemas/group.schema';

interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly groupsService: GroupsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user._id.toString();
    const { groupId, requestId } = request.params;

    let group: GroupDocument | null = null;

    if (groupId) {
      group = await this.groupsService.findById(groupId);
    } else if (requestId) {
      const joinRequest =
        await this.groupsService.findJoinRequestById(requestId);
      if (!joinRequest) {
        throw new NotFoundException(
          `Join request with ID '${requestId}' not found.`,
        );
      }
      // The group property on a join request holds the group's ID
      group = await this.groupsService.findById(
        joinRequest.group._id.toString(),
      );
    }

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.owner._id.toString() !== userId) {
      throw new ForbiddenException('You are not the owner of this group');
    }

    return true;
  }
}
