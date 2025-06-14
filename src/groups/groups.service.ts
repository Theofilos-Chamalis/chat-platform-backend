import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
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
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(JoinRequest.name)
    private joinRequestModel: Model<JoinRequestDocument>,
    @InjectModel(LeftGroupCooldown.name)
    private leftGroupCooldownModel: Model<LeftGroupCooldownDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createGroupDto: CreateGroupDto, ownerId: string) {
    this.logger.debug(
      `User ${ownerId} creating group: ${JSON.stringify(createGroupDto)}`,
    );
    const { name, type, maxMembers, initialMembers } = createGroupDto;

    const newGroup = new this.groupModel({
      name,
      type,
      maxMembers,
      owner: ownerId,
      members: [ownerId, ...(initialMembers || [])],
    });

    const savedGroup = await newGroup.save();
    this.logger.log(
      `Group '${
        savedGroup.name
      }' created with ID: ${savedGroup._id.toString()}`,
    );
    return savedGroup;
  }

  async join(groupId: string, userId: string) {
    this.logger.debug(`User ${userId} attempting to join group ${groupId}`);
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to join group: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    // Check if user is banned
    const isBanned = group.bannedUsers.some(
      (bannedUser) => bannedUser.user._id.toString() === userId,
    );
    if (isBanned) {
      this.logger.warn(
        `Banned user ${userId} attempted to join group ${groupId}.`,
      );
      throw new ForbiddenException(
        'You are banned from this group and cannot join.',
      );
    }

    if (group.members.some((member) => member._id.toString() === userId)) {
      this.logger.warn(
        `User ${userId} attempted to join group ${groupId} but is already a member.`,
      );
      throw new ConflictException('You are already a member of this group.');
    }

    if (group.type === 'public') {
      const user = await this.userModel.findById(userId);
      if (!user) {
        this.logger.error(
          `Failed to join group: User with ID ${userId} not found.`,
        );
        throw new NotFoundException(`User with ID '${userId}' not found.`);
      }
      group.members.push(user);
      await group.save();
      this.logger.log(
        `User ${userId} successfully joined public group ${groupId}.`,
      );
      return { message: 'Successfully joined group.' };
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
          this.logger.warn(
            `User ${userId} attempted to rejoin private group ${groupId} too soon.`,
          );
          throw new ForbiddenException(
            `You must wait approximately ${hoursLeft} more hours before you can request to join this group again.`,
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
        this.logger.warn(
          `User ${userId} attempted to join group ${groupId} but already has a pending request.`,
        );
        throw new ConflictException(
          'You already have a pending join request for this group.',
        );
      }

      const joinRequest = new this.joinRequestModel({
        group: groupId,
        user: userId,
      });

      await joinRequest.save();
      this.logger.log(
        `User ${userId} successfully sent a join request to private group ${groupId}.`,
      );
      return { message: 'Your request to join the group has been sent.' };
    }
  }

  async manageJoinRequest(requestId: string, action: 'approve' | 'decline') {
    this.logger.debug(
      `Managing join request ${requestId} with action: ${action}`,
    );
    const request = await this.findJoinRequestById(requestId);
    if (!request) {
      this.logger.error(
        `Failed to manage join request: Request with ID ${requestId} not found.`,
      );
      throw new NotFoundException(
        `Join request with ID '${requestId}' not found.`,
      );
    }

    if (request.status !== 'pending') {
      this.logger.warn(
        `Attempted to manage an already handled join request: ${requestId}.`,
      );
      throw new ConflictException(
        'This join request has already been resolved.',
      );
    }

    if (action === 'approve') {
      const group = await this.findById(request.group._id.toString());
      if (!group) {
        this.logger.error(
          `Failed to approve request ${requestId}: Group with ID ${request.group._id.toString()} not found.`,
        );
        throw new NotFoundException(
          `Could not find the associated group for this request.`,
        );
      }

      group.members.push(request.user);
      request.status = 'approved';

      await group.save();
      await request.save();
      this.logger.log(
        `Join request ${requestId} for user ${request.user._id.toString()} to group ${group._id.toString()} approved.`,
      );
      return { message: 'Join request approved.' };
    } else {
      // action === 'decline'
      request.status = 'declined';
      await request.save();
      this.logger.log(
        `Join request ${requestId} for user ${request.user._id.toString()} declined.`,
      );
      return { message: 'Join request declined.' };
    }
  }

  async leave(groupId: string, userId: string) {
    this.logger.debug(`User ${userId} attempting to leave group ${groupId}`);
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to leave group: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    if (!group.members.some((member) => member._id.toString() === userId)) {
      this.logger.warn(
        `User ${userId} attempted to leave group ${groupId} but is not a member.`,
      );
      throw new ConflictException('You are not a member of this group.');
    }

    if (group.owner._id.toString() === userId) {
      if (group.members.length > 1) {
        this.logger.warn(
          `Owner ${userId} attempted to leave group ${groupId} with other members present.`,
        );
        throw new ForbiddenException(
          'As the owner, you must transfer ownership before leaving the group, unless you are the last member.',
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
      this.logger.debug(
        `Created rejoin cooldown for user ${userId} in private group ${groupId}.`,
      );
    }

    group.members = group.members.filter(
      (member) => member._id.toString() !== userId,
    );
    await group.save();
    this.logger.log(`User ${userId} successfully left group ${groupId}.`);

    return { message: 'You have successfully left the group.' };
  }

  async kick(groupId: string, ownerId: string, memberId: string) {
    this.logger.debug(
      `Owner ${ownerId} attempting to kick member ${memberId} from group ${groupId}`,
    );
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to kick member: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    if (group.owner._id.toString() !== ownerId) {
      // This check is also in the guard, but it's good practice to have it in the service too.
      this.logger.error(
        `User ${ownerId} attempted to kick from group ${groupId} but is not the owner.`,
      );
      throw new ForbiddenException('Only the group owner can kick members.');
    }

    if (ownerId === memberId) {
      this.logger.warn(`Owner ${ownerId} attempted to kick themselves.`);
      throw new ForbiddenException('You cannot kick yourself from the group.');
    }

    const memberIndex = group.members.findIndex(
      (member) => member._id.toString() === memberId,
    );
    if (memberIndex === -1) {
      this.logger.warn(
        `Owner ${ownerId} attempted to kick non-existent member ${memberId} from group ${groupId}.`,
      );
      throw new NotFoundException(
        `The user with ID '${memberId}' is not a member of this group.`,
      );
    }

    group.members.splice(memberIndex, 1);
    await group.save();
    this.logger.log(
      `Owner ${ownerId} successfully kicked member ${memberId} from group ${groupId}.`,
    );

    return { message: 'Member has been successfully kicked from the group.' };
  }

  async ban(groupId: string, ownerId: string, memberId: string) {
    this.logger.debug(
      `Owner ${ownerId} attempting to ban member ${memberId} from group ${groupId}`,
    );
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to ban member: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    if (group.owner._id.toString() !== ownerId) {
      this.logger.error(
        `User ${ownerId} attempted to ban from group ${groupId} but is not the owner.`,
      );
      throw new ForbiddenException('Only the group owner can ban members.');
    }

    if (ownerId === memberId) {
      this.logger.warn(`Owner ${ownerId} attempted to ban themselves.`);
      throw new ForbiddenException('You cannot ban yourself from the group.');
    }

    const isBanned = group.bannedUsers.some(
      (banned) => banned.user._id.toString() === memberId,
    );
    if (isBanned) {
      this.logger.warn(
        `Owner ${ownerId} attempted to ban already-banned member ${memberId} from group ${groupId}.`,
      );
      throw new ConflictException(
        'This user is already banned from the group.',
      );
    }

    const userToBan = await this.userModel.findById(memberId);
    if (!userToBan) {
      this.logger.error(
        `Failed to ban member: User to ban with ID ${memberId} not found.`,
      );
      throw new NotFoundException(
        `Could not find a user with ID '${memberId}'.`,
      );
    }

    group.bannedUsers.push({ user: userToBan, bannedAt: new Date() });
    // Also remove them from members if they are currently a member
    group.members = group.members.filter(
      (member) => member._id.toString() !== memberId,
    );

    await group.save();
    this.logger.log(
      `Owner ${ownerId} successfully banned member ${memberId} from group ${groupId}.`,
    );
    return { message: 'Member has been successfully banned from the group.' };
  }

  async delete(groupId: string, ownerId: string) {
    this.logger.debug(`Owner ${ownerId} attempting to delete group ${groupId}`);
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to delete group: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    if (group.owner._id.toString() !== ownerId) {
      this.logger.error(
        `User ${ownerId} attempted to delete group ${groupId} but is not the owner.`,
      );
      throw new ForbiddenException(
        'Only the group owner can delete the group.',
      );
    }

    if (group.members.length > 1) {
      this.logger.warn(
        `Owner ${ownerId} attempted to delete group ${groupId} with other members present.`,
      );
      throw new ForbiddenException(
        'The group cannot be deleted because it still has other members.',
      );
    }

    await this.groupModel.deleteOne({ _id: groupId });
    this.logger.log(
      `Group ${groupId} successfully deleted by owner ${ownerId}.`,
    );
    return { message: 'Group has been successfully deleted.' };
  }

  async transferOwnership(
    groupId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    this.logger.debug(
      `Owner ${currentOwnerId} attempting to transfer ownership of group ${groupId} to user ${newOwnerId}`,
    );
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to transfer ownership: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    if (group.owner._id.toString() !== currentOwnerId) {
      this.logger.error(
        `User ${currentOwnerId} attempted to transfer ownership of group ${groupId} but is not the owner.`,
      );
      throw new ForbiddenException(
        'Only the current group owner can transfer ownership.',
      );
    }

    if (currentOwnerId === newOwnerId) {
      this.logger.warn(
        `Owner ${currentOwnerId} attempted to transfer ownership to themselves.`,
      );
      throw new ConflictException('You are already the owner of this group.');
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === newOwnerId,
    );
    if (!isMember) {
      this.logger.warn(
        `Owner ${currentOwnerId} attempted to transfer ownership to non-member ${newOwnerId}.`,
      );
      throw new NotFoundException(
        'The specified user must be a member of the group to become the owner.',
      );
    }

    const newOwner = await this.userModel.findById(newOwnerId);
    if (!newOwner) {
      this.logger.error(
        `Failed to transfer ownership: New owner with ID ${newOwnerId} not found.`,
      );
      throw new NotFoundException(
        `Could not find a user with ID '${newOwnerId}'.`,
      );
    }

    group.owner = newOwner;
    await group.save();
    this.logger.log(
      `Ownership of group ${groupId} successfully transferred from ${currentOwnerId} to ${newOwnerId}.`,
    );

    return { message: 'Group ownership has been successfully transferred.' };
  }

  async addMember(groupId: string, adderId: string, newMemberId: string) {
    this.logger.debug(
      `User ${adderId} attempting to add user ${newMemberId} to group ${groupId}`,
    );
    const group = await this.findById(groupId);
    if (!group) {
      this.logger.error(
        `Failed to add member: Group with ID ${groupId} not found.`,
      );
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    // Check if the user to be added exists
    const newMember = await this.userModel.findById(newMemberId);
    if (!newMember) {
      this.logger.error(
        `Failed to add member: User to add with ID ${newMemberId} not found.`,
      );
      throw new NotFoundException(
        `Could not find a user with ID '${newMemberId}'.`,
      );
    }

    // Authorization check
    if (group.type === 'private') {
      if (group.owner._id.toString() !== adderId) {
        this.logger.warn(
          `Non-owner ${adderId} attempted to add member to private group ${groupId}.`,
        );
        throw new ForbiddenException(
          'Only the group owner can add members to a private group.',
        );
      }
    } else {
      const isAdderAMember = group.members.some(
        (member) => member._id.toString() === adderId,
      );
      if (!isAdderAMember) {
        this.logger.warn(
          `Non-member ${adderId} attempted to add member to public group ${groupId}.`,
        );
        throw new ForbiddenException(
          'You must be a member of this group to add other users.',
        );
      }
    }

    if (group.members.some((member) => member._id.toString() === newMemberId)) {
      this.logger.warn(
        `User ${adderId} attempted to add existing member ${newMemberId} to group ${groupId}.`,
      );
      throw new ConflictException(
        'This user is already a member of this group.',
      );
    }

    if (
      group.bannedUsers.some(
        (banned) => banned.user._id.toString() === newMemberId,
      )
    ) {
      this.logger.warn(
        `User ${adderId} attempted to add banned user ${newMemberId} to group ${groupId}.`,
      );
      throw new ForbiddenException(
        'This user is banned and cannot be added to the group.',
      );
    }

    group.members.push(newMember);
    await group.save();
    this.logger.log(
      `User ${adderId} successfully added user ${newMemberId} to group ${groupId}.`,
    );

    return { message: 'Member added successfully.' };
  }

  async findById(id: string): Promise<GroupDocument | null> {
    this.logger.debug(`Searching for group with ID: ${id}`);
    return this.groupModel
      .findById(id)
      .populate('owner', '-password')
      .populate('members', '-password')
      .populate('bannedUsers.user', '-password')
      .exec();
  }

  async findGroupsForUser(userId: string): Promise<GroupDocument[]> {
    this.logger.debug(`Fetching groups for user ${userId}`);
    return this.groupModel
      .find({ members: userId })
      .populate('owner', '-password')
      .populate('members', '-password')
      .exec();
  }

  async findJoinRequestById(id: string): Promise<JoinRequestDocument | null> {
    this.logger.debug(`Searching for join request with ID: ${id}`);
    return this.joinRequestModel
      .findById(id)
      .populate('user', '-password')
      .exec();
  }

  async findJoinRequestsForGroup(
    groupId: string,
  ): Promise<JoinRequestDocument[]> {
    this.logger.debug(`Fetching join requests for group ${groupId}`);
    return this.joinRequestModel
      .find({ group: groupId, status: 'pending' })
      .populate('user', '-password')
      .exec();
  }
}
