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

interface AuthenticatedRequest extends Request {
  user: UserDocument;
}

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly groupsService: GroupsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user._id.toString();
    const groupId = request.params.id;

    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.owner._id.toString() !== userId) {
      throw new ForbiddenException('You are not the owner of this group');
    }

    return true;
  }
}
