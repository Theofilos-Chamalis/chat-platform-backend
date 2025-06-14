import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Group } from './group.schema';

export type LeftGroupCooldownDocument = HydratedDocument<LeftGroupCooldown>;

@Schema({ timestamps: true })
export class LeftGroupCooldown {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true })
  group: Group;

  @Prop({ required: true })
  leaveTime: Date;
}

export const LeftGroupCooldownSchema =
  SchemaFactory.createForClass(LeftGroupCooldown);
