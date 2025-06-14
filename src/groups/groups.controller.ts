import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Delete,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { OwnerGuard } from './guards/owner.guard';
import { ManageJoinRequestDto } from './dto/manage-join-request.dto';
import { BanMemberDto } from './dto/ban-member.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createGroupDto: CreateGroupDto,
    @Request() req: { user: UserDocument },
  ) {
    return this.groupsService.create(createGroupDto, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  join(@Param('id') groupId: string, @Request() req: { user: UserDocument }) {
    return this.groupsService.join(groupId, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard, OwnerGuard)
  @Post(':id/requests/:requestId')
  manageJoinRequest(
    @Param('requestId') requestId: string,
    @Body() manageJoinRequestDto: ManageJoinRequestDto,
  ) {
    return this.groupsService.manageJoinRequest(
      requestId,
      manageJoinRequestDto.action,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  leave(@Param('id') groupId: string, @Request() req: { user: UserDocument }) {
    return this.groupsService.leave(groupId, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard, OwnerGuard)
  @Delete(':id/members/:memberId')
  kick(
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
    @Request() req: { user: UserDocument },
  ) {
    return this.groupsService.kick(groupId, req.user._id.toString(), memberId);
  }

  @UseGuards(JwtAuthGuard, OwnerGuard)
  @Post(':id/ban')
  ban(
    @Param('id') groupId: string,
    @Body() banMemberDto: BanMemberDto,
    @Request() req: { user: UserDocument },
  ) {
    return this.groupsService.ban(
      groupId,
      req.user._id.toString(),
      banMemberDto.memberId,
    );
  }

  @UseGuards(JwtAuthGuard, OwnerGuard)
  @Delete(':id')
  delete(@Param('id') groupId: string, @Request() req: { user: UserDocument }) {
    return this.groupsService.delete(groupId, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard, OwnerGuard)
  @Post(':id/transfer-ownership')
  transferOwnership(
    @Param('id') groupId: string,
    @Body() transferOwnershipDto: TransferOwnershipDto,
    @Request() req: { user: UserDocument },
  ) {
    return this.groupsService.transferOwnership(
      groupId,
      req.user._id.toString(),
      transferOwnershipDto.newOwnerId,
    );
  }
}
