import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import { JoinRequest, JoinRequestSchema } from './schemas/join-request.schema';
import {
  LeftGroupCooldown,
  LeftGroupCooldownSchema,
} from './schemas/left-group-cooldown.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: JoinRequest.name, schema: JoinRequestSchema },
      { name: LeftGroupCooldown.name, schema: LeftGroupCooldownSchema },
    ]),
    UsersModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
