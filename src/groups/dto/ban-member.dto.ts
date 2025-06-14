import { IsString } from 'class-validator';

export class BanMemberDto {
  @IsString()
  memberId: string;
}
