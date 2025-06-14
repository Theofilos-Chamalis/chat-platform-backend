import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({
    example: 'My Awesome Group',
    description: 'The name of the group',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: ['public', 'private'],
    example: 'public',
    description: 'The type of the group',
  })
  @IsEnum(['public', 'private'])
  @IsNotEmpty()
  type: 'public' | 'private';

  @ApiProperty({
    example: 50,
    description: 'The maximum number of members allowed in the group',
    minimum: 2,
  })
  @IsNumber()
  @Min(2)
  @IsOptional()
  maxMembers?: number;

  @ApiProperty({
    description:
      'An optional array of user IDs to invite to the group upon creation',
    type: [String],
    required: false,
    example: ['60f7e6c9b5d5d8a0c4f5a3b2', '60f7e6c9b5d5d8a0c4f5a3b3'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  initialMembers?: string[];
}
