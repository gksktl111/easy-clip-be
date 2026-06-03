import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { AuthContext } from 'src/common/types/auth-context.type';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
import { GetMySubscriptionUseCase } from '../application/usecases/get-my-subscription.usecase';
import { UpdateMySubscriptionUseCase } from '../application/usecases/update-my-subscription.usecase';
import { UpdateMySubscriptionDto } from './dtos/update-my-subscription.dto';

@Controller('workspaces')
@UseFilters(ApplicationExceptionFilter)
export class WorkspacesController {
  constructor(
    private readonly getMySubscriptionUseCase: GetMySubscriptionUseCase,
    private readonly updateMySubscriptionUseCase: UpdateMySubscriptionUseCase,
  ) {}

  @Get('me/subscription')
  @UseGuards(JwtAccessGuard)
  getMySubscription(@Request() req: { user: AuthContext }) {
    return this.getMySubscriptionUseCase.execute(req.user.userId);
  }

  @Patch('me/subscription')
  @UseGuards(JwtAccessGuard)
  updateMySubscription(
    @Request() req: { user: AuthContext },
    @Body() dto: UpdateMySubscriptionDto,
  ) {
    return this.updateMySubscriptionUseCase.execute(req.user.userId, dto);
  }
}
