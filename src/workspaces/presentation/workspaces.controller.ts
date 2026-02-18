import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthContext } from 'src/auth/application/auth-context';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { GetMySubscriptionUseCase } from '../application/usecases/get-my-subscription.usecase';
import { UpdateMySubscriptionUseCase } from '../application/usecases/update-my-subscription.usecase';
import { WorkspacesError } from '../application/workspaces.error';
import { UpdateMySubscriptionDto } from './dtos/update-my-subscription.dto';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly getMySubscriptionUseCase: GetMySubscriptionUseCase,
    private readonly updateMySubscriptionUseCase: UpdateMySubscriptionUseCase,
  ) {}

  @Get('me/subscription')
  @UseGuards(JwtAccessGuard)
  getMySubscription(@Request() req: { user: AuthContext }) {
    return this.run(() =>
      this.getMySubscriptionUseCase.execute(req.user.userId),
    );
  }

  @Patch('me/subscription')
  @UseGuards(JwtAccessGuard)
  updateMySubscription(
    @Request() req: { user: AuthContext },
    @Body() dto: UpdateMySubscriptionDto,
  ) {
    return this.run(() =>
      this.updateMySubscriptionUseCase.execute(req.user.userId, dto),
    );
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof WorkspacesError) {
        throw this.toHttpException(error);
      }

      throw error;
    }
  }

  private toHttpException(error: WorkspacesError) {
    switch (error.code) {
      case 'BAD_REQUEST':
        return new BadRequestException(error.message);
      case 'NOT_FOUND':
        return new NotFoundException(error.message);
      case 'CONFLICT':
        return new ConflictException(error.message);
      default:
        return new InternalServerErrorException(error.message);
    }
  }
}
