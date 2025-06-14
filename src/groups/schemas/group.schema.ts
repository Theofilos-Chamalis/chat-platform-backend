import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true, autoCreate: true, collection: 'chat-groups' })
export class Group {}

export const GroupSchema = SchemaFactory.createForClass(Group);
