import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'The MongoDB ObjectId of the user to add to the group.',
    example: '60f7e6c9b5d5d8a0c4f5a3b2',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}
