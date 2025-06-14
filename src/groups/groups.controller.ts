import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Delete,
  Patch,
  Get,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ManageJoinRequestDto } from './dto/manage-join-request.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { OwnerGuard } from './guards/owner.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { UserDocument } from 'src/users/schemas/user.schema';

interface AuthenticatedRequest {
  user: UserDocument;
}

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all groups for the current user' })
  @ApiResponse({
    status: 200,
    description: 'A list of groups the user is a member of.',
  })
  findUserGroups(@Request() req: AuthenticatedRequest) {
    return this.groupsService.findGroupsForUser(req.user._id.toString());
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Get details for a specific group' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiResponse({ status: 200, description: 'The group details.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User is not a member of the group.',
  })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  async findOne(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    const isMember = group.members.some(
      (member: UserDocument) =>
        member._id.toString() === req.user._id.toString(),
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group.');
    }

    return group;
  }

  @Get(':groupId/members')
  @ApiOperation({ summary: 'Get the list of members for a specific group' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiResponse({ status: 200, description: 'The list of group members.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User is not a member of the group.',
  })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  async getGroupMembers(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const group = await this.groupsService.findById(groupId);
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found.`);
    }

    const isMember = group.members.some(
      (member: UserDocument) =>
        member._id.toString() === req.user._id.toString(),
    );

    if (!isMember) {
      throw new ForbiddenException(
        'You must be a member of this group to view its members.',
      );
    }

    return group.members;
  }

  @Get(':groupId/join-requests')
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Get pending join requests for a group (Owner only)',
  })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiResponse({
    status: 200,
    description: 'A list of pending join requests.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can view join requests.',
  })
  getJoinRequests(@Param('groupId') groupId: string) {
    return this.groupsService.findJoinRequestsForGroup(groupId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  @ApiResponse({
    status: 201,
    description: 'The group has been successfully created.',
  })
  create(
    @Body() createGroupDto: CreateGroupDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.create(createGroupDto, req.user._id.toString());
  }

  @Post(':groupId/join')
  @ApiOperation({ summary: 'Join a group or request to join' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group to join' })
  @ApiResponse({
    status: 201,
    description: 'Successfully joined or requested to join.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User is banned or on cooldown.',
  })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @ApiResponse({
    status: 409,
    description: 'User is already a member or has a pending request.',
  })
  join(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.join(groupId, req.user._id.toString());
  }

  @Post(':groupId/add-member')
  @ApiOperation({ summary: 'Add a new member to a group' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiResponse({ status: 201, description: 'Member added successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Not enough permissions.',
  })
  @ApiResponse({ status: 404, description: 'Group or user not found.' })
  @ApiResponse({
    status: 409,
    description: 'User is already a member or banned.',
  })
  addMember(
    @Param('groupId') groupId: string,
    @Body() addMemberDto: AddMemberDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.addMember(
      groupId,
      req.user._id.toString(),
      addMemberDto.userId,
    );
  }

  @Patch('join-requests/:requestId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: "Approve or decline a user's join request" })
  @ApiParam({ name: 'requestId', description: 'The ID of the join request' })
  @ApiResponse({ status: 200, description: 'Request successfully managed.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can manage requests.',
  })
  @ApiResponse({ status: 404, description: 'Request or group not found.' })
  @ApiResponse({ status: 409, description: 'Request already resolved.' })
  manageJoinRequest(
    @Param('requestId') requestId: string,
    @Body() manageJoinRequestDto: ManageJoinRequestDto,
  ) {
    return this.groupsService.manageJoinRequest(
      requestId,
      manageJoinRequestDto.action,
    );
  }

  @Post(':groupId/leave')
  @ApiOperation({ summary: 'Leave a group' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group to leave' })
  @ApiResponse({ status: 201, description: 'Successfully left the group.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Owner cannot leave with members present.',
  })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  @ApiResponse({ status: 409, description: 'User is not a member.' })
  leave(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.leave(groupId, req.user._id.toString());
  }

  @Post(':groupId/kick/:memberId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Kick a member from a group (Owner only)' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiParam({ name: 'memberId', description: 'The ID of the member to kick' })
  @ApiResponse({ status: 201, description: 'Member kicked successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can kick.',
  })
  @ApiResponse({ status: 404, description: 'Group or member not found.' })
  kick(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.kick(groupId, req.user._id.toString(), memberId);
  }

  @Post(':groupId/ban/:memberId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Ban a member from a group (Owner only)' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiParam({ name: 'memberId', description: 'The ID of the member to ban' })
  @ApiResponse({ status: 201, description: 'Member banned successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can ban.',
  })
  @ApiResponse({ status: 404, description: 'Group or user to ban not found.' })
  @ApiResponse({ status: 409, description: 'User is already banned.' })
  ban(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.ban(groupId, req.user._id.toString(), memberId);
  }

  @Delete(':groupId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Delete a group (Owner only)' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group to delete' })
  @ApiResponse({ status: 200, description: 'Group deleted successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only owner can delete, and only if empty.',
  })
  @ApiResponse({ status: 404, description: 'Group not found.' })
  delete(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.delete(groupId, req.user._id.toString());
  }

  @Patch(':groupId/transfer-ownership')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Transfer group ownership (Owner only)' })
  @ApiParam({ name: 'groupId', description: 'The ID of the group' })
  @ApiBody({ type: TransferOwnershipDto })
  @ApiResponse({
    status: 200,
    description: 'Ownership transferred successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the owner can transfer.',
  })
  @ApiResponse({ status: 404, description: 'Group or new owner not found.' })
  @ApiResponse({
    status: 409,
    description: 'New owner is already the owner or not a member.',
  })
  transferOwnership(
    @Param('groupId') groupId: string,
    @Body() transferOwnershipDto: TransferOwnershipDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.groupsService.transferOwnership(
      groupId,
      req.user._id.toString(),
      transferOwnershipDto.newOwnerId,
    );
  }
}
