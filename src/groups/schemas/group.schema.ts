import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { UserDocument } from '../../users/schemas/user.schema';

export type GroupDocument = HydratedDocument<Group>;

@Schema({ timestamps: true })
export class BannedUser {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: UserDocument;

  @Prop({ default: Date.now })
  bannedAt: Date;
}
const BannedUserSchema = SchemaFactory.createForClass(BannedUser);

@Schema({ timestamps: true, autoCreate: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: ['public', 'private'], required: true })
  type: 'public' | 'private';

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  owner: UserDocument;

  @Prop([{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }])
  members: UserDocument[];

  @Prop({ min: 2 })
  maxMembers: number;

  @Prop({ type: [BannedUserSchema], default: [] })
  bannedUsers: BannedUser[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
