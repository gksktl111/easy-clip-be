import { IsIn, IsOptional } from 'class-validator';
import {
  WorkspaceSubscriptionAction,
  WorkspaceSubscriptionPlan,
} from '../../domain/workspace.types';

const SUBSCRIPTION_ACTION_VALUES = Object.values(WorkspaceSubscriptionAction);
const SUBSCRIPTION_PLAN_VALUES = Object.values(WorkspaceSubscriptionPlan);

export class UpdateMySubscriptionDto {
  @IsIn(SUBSCRIPTION_ACTION_VALUES)
  type: (typeof SUBSCRIPTION_ACTION_VALUES)[number];

  @IsOptional()
  @IsIn(SUBSCRIPTION_PLAN_VALUES)
  plan?: (typeof SUBSCRIPTION_PLAN_VALUES)[number];
}
