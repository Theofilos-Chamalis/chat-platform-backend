import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateGroupDto } from './dto/create-group.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { Model } from 'mongoose';
import {
  JoinRequest,
  JoinRequestDocument,
} from './schemas/join-request.schema';
import {
  LeftGroupCooldown,
  LeftGroupCooldownDocument,
} from './schemas/left-group-cooldown.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(JoinRequest.name)
    private joinRequestModel: Model<JoinRequestDocument>,
    @InjectModel(LeftGroupCooldown.name)
    private leftGroupCooldownModel: Model<LeftGroupCooldownDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createGroupDto: CreateGroupDto, ownerId: string) {
    const { name, type, maxMembers, initialMembers } = createGroupDto;

    const newGroup = new this.groupModel({
      name,
      type,
      maxMembers,
      owner: ownerId,
      members: [ownerId, ...(initialMembers || [])],
    });

    return newGroup.save();
  }

  async join(groupId: string, userId: string) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is banned
    const isBanned = group.bannedUsers.some(
      (bannedUser) => bannedUser.user._id.toString() === userId,
    );
    if (isBanned) {
      throw new ForbiddenException(
        'You are banned from this group and cannot join.',
      );
    }

    if (group.members.some((member) => member._id.toString() === userId)) {
      throw new ConflictException('User is already a member of this group');
    }

    if (group.type === 'public') {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      group.members.push(user);
      await group.save();
      return { message: 'Successfully joined group' };
    } else {
      // Private group: Check for cooldown
      const cooldownRecord = await this.leftGroupCooldownModel
        .findOne({
          group: groupId,
          user: userId,
        })
        .sort({ leaveTime: -1 });

      if (cooldownRecord) {
        const fortyEightHours = 48 * 60 * 60 * 1000;
        const timeSinceLeave =
          new Date().getTime() - cooldownRecord.leaveTime.getTime();

        if (timeSinceLeave < fortyEightHours) {
          const timeLeft = fortyEightHours - timeSinceLeave;
          const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));
          throw new ForbiddenException(
            `You must wait ${hoursLeft} more hours before you can request to join this group again.`,
          );
        }
      }

      // Private group: Check for existing request
      const existingRequest = await this.joinRequestModel.findOne({
        group: groupId,
        user: userId,
        status: 'pending',
      });

      if (existingRequest) {
        throw new ConflictException('Join request already pending');
      }

      const joinRequest = new this.joinRequestModel({
        group: groupId,
        user: userId,
      });

      await joinRequest.save();
      return { message: 'Join request sent' };
    }
  }

  async manageJoinRequest(requestId: string, action: 'approve' | 'decline') {
    const request = await this.findJoinRequestById(requestId);
    if (!request) {
      throw new NotFoundException('Join request not found');
    }

    if (request.status !== 'pending') {
      throw new ConflictException('Join request has already been handled');
    }

    if (action === 'approve') {
      const group = await this.findById(request.group._id.toString());
      if (!group) {
        throw new NotFoundException('Group not found');
      }

      group.members.push(request.user);
      request.status = 'approved';

      await group.save();
      await request.save();

      return { message: 'Join request approved' };
    } else {
      // action === 'decline'
      request.status = 'declined';
      await request.save();
      return { message: 'Join request declined' };
    }
  }

  async leave(groupId: string, userId: string) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.members.some((member) => member._id.toString() === userId)) {
      throw new ConflictException('User is not a member of this group');
    }

    if (group.owner._id.toString() === userId) {
      if (group.members.length > 1) {
        throw new ForbiddenException(
          'Owner cannot leave the group unless they are the last member. Transfer ownership first.',
        );
      }
    }

    if (group.type === 'private') {
      const cooldown = new this.leftGroupCooldownModel({
        user: userId,
        group: groupId,
        leaveTime: new Date(),
      });
      await cooldown.save();
    }

    group.members = group.members.filter(
      (member) => member._id.toString() !== userId,
    );
    await group.save();

    return { message: 'Successfully left group' };
  }

  async kick(groupId: string, ownerId: string, memberId: string) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.owner._id.toString() !== ownerId) {
      throw new ForbiddenException('Only the group owner can kick members');
    }

    if (ownerId === memberId) {
      throw new ForbiddenException('Owner cannot kick themselves');
    }

    const memberIndex = group.members.findIndex(
      (member) => member._id.toString() === memberId,
    );
    if (memberIndex === -1) {
      throw new NotFoundException('Member not found in this group');
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    return { message: 'Member kicked successfully' };
  }

  async ban(groupId: string, ownerId: string, memberId: string) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.owner._id.toString() !== ownerId) {
      throw new ForbiddenException('Only the group owner can ban members');
    }

    if (ownerId === memberId) {
      throw new ForbiddenException('Owner cannot ban themselves');
    }

    const isBanned = group.bannedUsers.some(
      (banned) => banned.user._id.toString() === memberId,
    );
    if (isBanned) {
      throw new ConflictException('User is already banned from this group');
    }

    const userToBan = await this.userModel.findById(memberId);
    if (!userToBan) {
      throw new NotFoundException('User to ban not found');
    }

    group.bannedUsers.push({ user: userToBan, bannedAt: new Date() });
    group.members = group.members.filter(
      (member) => member._id.toString() !== memberId,
    );

    await group.save();
    return { message: 'Member banned successfully' };
  }

  async delete(groupId: string, ownerId: string) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.owner._id.toString() !== ownerId) {
      throw new ForbiddenException('Only the group owner can delete the group');
    }

    if (group.members.length > 1) {
      throw new ForbiddenException(
        'Cannot delete group with more than one member',
      );
    }

    await this.groupModel.deleteOne({ _id: groupId });
    return { message: 'Group deleted successfully' };
  }

  async transferOwnership(
    groupId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.owner._id.toString() !== currentOwnerId) {
      throw new ForbiddenException(
        'Only the group owner can transfer ownership',
      );
    }

    if (currentOwnerId === newOwnerId) {
      throw new ConflictException(
        'New owner cannot be the same as the current owner',
      );
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === newOwnerId,
    );
    if (!isMember) {
      throw new NotFoundException('New owner is not a member of this group');
    }

    const newOwner = await this.userModel.findById(newOwnerId);
    if (!newOwner) {
      throw new NotFoundException('New owner not found');
    }

    group.owner = newOwner;
    await group.save();

    return { message: 'Ownership transferred successfully' };
  }

  async findById(id: string): Promise<GroupDocument | null> {
    return this.groupModel.findById(id).exec();
  }

  async findJoinRequestById(id: string): Promise<JoinRequestDocument | null> {
    return this.joinRequestModel.findById(id).exec();
  }
}
