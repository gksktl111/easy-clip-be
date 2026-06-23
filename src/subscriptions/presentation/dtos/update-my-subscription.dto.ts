import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SubscriptionAction } from '../../domain/subscription.types';

const SUBSCRIPTION_ACTION_VALUES = Object.values(SubscriptionAction);

export class UpdateMySubscriptionDto {
  @ApiProperty({
    enum: SUBSCRIPTION_ACTION_VALUES,
    example: SubscriptionAction.CANCEL,
    description:
      'PRO 전환은 결제 성공 유스케이스로만 수행합니다. 이 API는 자동갱신 해지/재개만 처리합니다.',
  })
  @IsIn(SUBSCRIPTION_ACTION_VALUES)
  type: (typeof SUBSCRIPTION_ACTION_VALUES)[number];
}
