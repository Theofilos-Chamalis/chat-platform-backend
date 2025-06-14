import { IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  groupId: string;

  @IsString()
  content: string;
}
