import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Group } from '../../groups/schemas/group.schema';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ autoCreate: true })
export class Message {
  @Prop({ required: true })
  content: string; // This will be encrypted

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  sender: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true })
  group: Group;

  @Prop({ required: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
