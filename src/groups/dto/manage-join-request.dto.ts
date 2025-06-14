import { IsEnum } from 'class-validator';

enum JoinRequestAction {
  Approve = 'approve',
  Decline = 'decline',
}

export class ManageJoinRequestDto {
  @IsEnum(JoinRequestAction)
  action: JoinRequestAction;
}
