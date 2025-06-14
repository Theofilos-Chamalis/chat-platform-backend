import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'The ID of the group where the message is being sent',
    example: '60f7e6c9b5d5d8a0c4f5a3b1',
  })
  @IsMongoId()
  @IsNotEmpty()
  groupId: string;

  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello everyone!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
