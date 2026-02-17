import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthContext } from 'src/auth/application/auth-context';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { GetMeUseCase } from '../application/usecases/get-me.usecase';
import { UpdateMeUseCase } from '../application/usecases/update-me.usecase';
import { DeleteMeUseCase } from '../application/usecases/delete-me.usecase';
import { GetUserSettingsUseCase } from '../application/usecases/get-user-settings.usecase';
import { UpdateUserSettingsUseCase } from '../application/usecases/update-user-settings.usecase';
import { UsersError } from '../application/users.error';
import { UpdateMeDto } from './dtos/update-me.dto';
import { UpdateUserSettingsDto } from './dtos/update-user-settings.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly getMeUseCase: GetMeUseCase,
    private readonly updateMeUseCase: UpdateMeUseCase,
    private readonly deleteMeUseCase: DeleteMeUseCase,
    private readonly getUserSettingsUseCase: GetUserSettingsUseCase,
    private readonly updateUserSettingsUseCase: UpdateUserSettingsUseCase,
  ) {}

  @Get('me')
  @UseGuards(JwtAccessGuard)
  getMe(@Request() req: { user: AuthContext }) {
    return this.run(() =>
      this.getMeUseCase.execute(req.user.userId, req.user.accountId),
    );
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  updateMe(@Request() req: { user: AuthContext }, @Body() dto: UpdateMeDto) {
    return this.run(() =>
      this.updateMeUseCase.execute(req.user.userId, req.user.accountId, dto),
    );
  }

  @Delete('me')
  @UseGuards(JwtAccessGuard)
  deleteMe(@Request() req: { user: AuthContext }) {
    return this.run(() => this.deleteMeUseCase.execute(req.user.userId));
  }

  @Get('me/settings')
  @UseGuards(JwtAccessGuard)
  getMySettings(@Request() req: { user: AuthContext }) {
    return this.run(() => this.getUserSettingsUseCase.execute(req.user.userId));
  }

  @Patch('me/settings')
  @UseGuards(JwtAccessGuard)
  updateMySettings(
    @Request() req: { user: AuthContext },
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.run(() =>
      this.updateUserSettingsUseCase.execute(req.user.userId, dto),
    );
  }

  private async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof UsersError) {
        throw this.toHttpException(error);
      }

      throw error;
    }
  }

  private toHttpException(error: UsersError) {
    switch (error.code) {
      case 'BAD_REQUEST':
        return new BadRequestException(error.message);
      case 'NOT_FOUND':
        return new NotFoundException(error.message);
      default:
        return new InternalServerErrorException(error.message);
    }
  }
}
