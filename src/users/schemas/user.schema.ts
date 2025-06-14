import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, autoCreate: true, collection: 'chat-users' })
export class User {}

export const UserSchema = SchemaFactory.createForClass(User);
