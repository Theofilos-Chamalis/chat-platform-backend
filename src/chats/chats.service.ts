import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createMessage(
    sendMessageDto: SendMessageDto,
    senderId: string,
  ): Promise<MessageDocument> {
    const { groupId, content } = sendMessageDto;
    this.logger.debug(`User ${senderId} creating message in group ${groupId}`);
    const createdMessage = new this.messageModel({
      group: groupId,
      sender: senderId,
      content,
      timestamp: new Date(),
    });
    const savedMessage = await createdMessage.save();
    this.logger.log(
      `Message ${savedMessage._id.toString()} saved to database.`,
    );
    return savedMessage.populate('sender');
  }

  async getMessages(groupId: string): Promise<MessageDocument[]> {
    this.logger.debug(`Fetching messages for group ${groupId}`);
    return this.messageModel.find({ group: groupId }).populate('sender').exec();
  }
}
