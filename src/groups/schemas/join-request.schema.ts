import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { UserDocument } from '../../users/schemas/user.schema';
import { GroupDocument } from './group.schema';

export type JoinRequestDocument = HydratedDocument<JoinRequest>;

@Schema({ timestamps: true })
export class JoinRequest {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true })
  group: GroupDocument;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: UserDocument;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'declined'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'declined';
}

export const JoinRequestSchema = SchemaFactory.createForClass(JoinRequest);
