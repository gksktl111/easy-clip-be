import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Request,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/common/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
import { GetMeUseCase } from '../application/usecases/get-me.usecase';
import { UpdateMeUseCase } from '../application/usecases/update-me.usecase';
import { DeleteMeUseCase } from '../application/usecases/delete-me.usecase';
import { GetUserSettingsUseCase } from '../application/usecases/get-user-settings.usecase';
import { UpdateUserSettingsUseCase } from '../application/usecases/update-user-settings.usecase';
import { UpdateMeDto } from './dtos/update-me.dto';
import { UpdateUserSettingsDto } from './dtos/update-user-settings.dto';

@Controller('users')
@UseFilters(ApplicationExceptionFilter)
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
    return this.getMeUseCase.execute(req.user.userId, req.user.accountId);
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  updateMe(@Request() req: { user: AuthContext }, @Body() dto: UpdateMeDto) {
    return this.updateMeUseCase.execute(
      req.user.userId,
      req.user.accountId,
      dto,
    );
  }

  @Delete('me')
  @UseGuards(JwtAccessGuard)
  deleteMe(@Request() req: { user: AuthContext }) {
    return this.deleteMeUseCase.execute(req.user.userId);
  }

  @Get('me/settings')
  @UseGuards(JwtAccessGuard)
  getMySettings(@Request() req: { user: AuthContext }) {
    return this.getUserSettingsUseCase.execute(req.user.userId);
  }

  @Patch('me/settings')
  @UseGuards(JwtAccessGuard)
  updateMySettings(
    @Request() req: { user: AuthContext },
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.updateUserSettingsUseCase.execute(req.user.userId, dto);
  }
}
