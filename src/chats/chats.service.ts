import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createMessage(content: string, senderId: string, groupId: string) {
    const newMessage = new this.messageModel({
      content,
      sender: senderId,
      group: groupId,
      timestamp: new Date(),
    });

    return newMessage.save();
  }

  async getMessages(groupId: string) {
    return this.messageModel.find({ group: groupId }).exec();
  }
}
