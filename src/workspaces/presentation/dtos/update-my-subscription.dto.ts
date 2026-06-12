import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  WorkspaceSubscriptionAction,
  WorkspaceSubscriptionPlan,
} from '../../domain/workspace.types';

const SUBSCRIPTION_ACTION_VALUES = Object.values(WorkspaceSubscriptionAction);
const SUBSCRIPTION_PLAN_VALUES = Object.values(WorkspaceSubscriptionPlan);

export class UpdateMySubscriptionDto {
  @ApiProperty({
    enum: SUBSCRIPTION_ACTION_VALUES,
    example: WorkspaceSubscriptionAction.CHANGE_PLAN,
  })
  @IsIn(SUBSCRIPTION_ACTION_VALUES)
  type: (typeof SUBSCRIPTION_ACTION_VALUES)[number];

  @ApiPropertyOptional({
    enum: SUBSCRIPTION_PLAN_VALUES,
    example: WorkspaceSubscriptionPlan.PRO,
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_PLAN_VALUES)
  plan?: (typeof SUBSCRIPTION_PLAN_VALUES)[number];
}
