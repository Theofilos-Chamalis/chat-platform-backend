import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

enum GroupType {
  Public = 'public',
  Private = 'private',
}

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsEnum(GroupType)
  type: GroupType;

  @IsNumber()
  @Min(2)
  @IsOptional()
  maxMembers?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  initialMembers?: string[];
}
