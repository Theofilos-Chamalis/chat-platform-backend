import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TransferOwnershipDto {
  @ApiProperty({
    example: '60f7e6c9b5d5d8a0c4f5a3b2',
    description: 'The ID of the user to transfer ownership to',
  })
  @IsString()
  @IsNotEmpty()
  newOwnerId: string;
}
