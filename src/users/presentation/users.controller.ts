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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { GetMeUseCase } from '../application/usecases/get-me.usecase';
import { UpdateMeUseCase } from '../application/usecases/update-me.usecase';
import { DeleteMeUseCase } from '../application/usecases/delete-me.usecase';
import { GetUserSettingsUseCase } from '../application/usecases/get-user-settings.usecase';
import { UpdateUserSettingsUseCase } from '../application/usecases/update-user-settings.usecase';
import { UpdateMeDto } from './dtos/update-me.dto';
import { UpdateUserSettingsDto } from './dtos/update-user-settings.dto';
import {
  DeleteMeResponseDto,
  UserProfileResponseDto,
  UserSettingsResponseDto,
} from './dtos/user-response.dto';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';

@Controller('users')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
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
  @ApiOperation({ summary: '내 프로필 조회' })
  @ApiOkResponse({
    description: '현재 로그인한 사용자 프로필을 반환합니다.',
    type: UserProfileResponseDto,
  })
  getMe(@Request() req: { user: AuthContext }) {
    return this.getMeUseCase.execute(req.user.userId, req.user.accountId);
  }

  @Patch('me')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 프로필 수정' })
  @ApiBody({ type: UpdateMeDto })
  @ApiOkResponse({
    description: '수정된 사용자 프로필을 반환합니다.',
    type: UserProfileResponseDto,
  })
  updateMe(@Request() req: { user: AuthContext }, @Body() dto: UpdateMeDto) {
    return this.updateMeUseCase.execute(
      req.user.userId,
      req.user.accountId,
      dto,
    );
  }

  @Delete('me')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 계정 삭제' })
  @ApiOkResponse({
    description: '계정 삭제 결과를 반환합니다.',
    type: DeleteMeResponseDto,
  })
  deleteMe(@Request() req: { user: AuthContext }) {
    return this.deleteMeUseCase.execute(req.user.userId);
  }

  @Get('me/settings')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 설정 조회' })
  @ApiOkResponse({
    description: '현재 사용자 설정을 반환합니다.',
    type: UserSettingsResponseDto,
  })
  getMySettings(@Request() req: { user: AuthContext }) {
    return this.getUserSettingsUseCase.execute(req.user.userId);
  }

  @Patch('me/settings')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 설정 수정' })
  @ApiBody({ type: UpdateUserSettingsDto })
  @ApiOkResponse({
    description: '저장된 사용자 설정을 반환합니다.',
    type: UserSettingsResponseDto,
  })
  updateMySettings(
    @Request() req: { user: AuthContext },
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.updateUserSettingsUseCase.execute(req.user.userId, dto);
  }
}
