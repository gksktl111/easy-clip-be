import {
  Body,
  Controller,
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
import { AuthContext } from 'src/shared/types/auth-context.type';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { GetMySubscriptionUseCase } from '../application/usecases/get-my-subscription.usecase';
import { UpdateMySubscriptionUseCase } from '../application/usecases/update-my-subscription.usecase';
import { UpdateMySubscriptionDto } from './dtos/update-my-subscription.dto';
import { MySubscriptionResponseDto } from './dtos/workspace-response.dto';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';

@Controller('workspaces')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
export class WorkspacesController {
  constructor(
    private readonly getMySubscriptionUseCase: GetMySubscriptionUseCase,
    private readonly updateMySubscriptionUseCase: UpdateMySubscriptionUseCase,
  ) {}

  @Get('me/subscription')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 구독 정보 조회' })
  @ApiOkResponse({
    description: '개인 워크스페이스의 구독 상태를 반환합니다.',
    type: MySubscriptionResponseDto,
  })
  getMySubscription(@Request() req: { user: AuthContext }) {
    return this.getMySubscriptionUseCase.execute(req.user.userId);
  }

  @Patch('me/subscription')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 구독 정보 변경' })
  @ApiBody({ type: UpdateMySubscriptionDto })
  @ApiOkResponse({
    description: '변경 후 구독 상태를 반환합니다.',
    type: MySubscriptionResponseDto,
  })
  updateMySubscription(
    @Request() req: { user: AuthContext },
    @Body() dto: UpdateMySubscriptionDto,
  ) {
    return this.updateMySubscriptionUseCase.execute(req.user.userId, dto);
  }
}
