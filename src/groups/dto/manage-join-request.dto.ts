import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ManageJoinRequestDto {
  @ApiProperty({
    enum: ['approve', 'decline'],
    example: 'approve',
    description:
      "The action to take on the join request ('approve' or 'decline')",
  })
  @IsEnum(['approve', 'decline'])
  @IsNotEmpty()
  action: 'approve' | 'decline';
}
