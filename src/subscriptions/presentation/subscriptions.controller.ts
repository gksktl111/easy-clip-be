import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { ConfirmBillingAuthUseCase } from '../application/usecases/confirm-billing-auth.usecase';
import { CreateBillingAuthRequestUseCase } from '../application/usecases/create-billing-auth-request.usecase';
import { GetMySubscriptionUseCase } from '../application/usecases/get-my-subscription.usecase';
import { ProcessDueAutoRenewalsUseCase } from '../application/usecases/process-due-auto-renewals.usecase';
import { UpdateMySubscriptionUseCase } from '../application/usecases/update-my-subscription.usecase';
import { ConfirmBillingAuthDto } from './dtos/confirm-billing-auth.dto';
import {
  BillingAuthRequestResponseDto,
  MySubscriptionResponseDto,
  ProcessDueAutoRenewalsResponseDto,
} from './dtos/subscription-response.dto';
import { UpdateMySubscriptionDto } from './dtos/update-my-subscription.dto';

@Controller()
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description: '액세스 토큰이 없거나 유효하지 않습니다.',
  type: ErrorResponseDto,
})
export class SubscriptionsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly getMySubscriptionUseCase: GetMySubscriptionUseCase,
    private readonly updateMySubscriptionUseCase: UpdateMySubscriptionUseCase,
    private readonly createBillingAuthRequestUseCase: CreateBillingAuthRequestUseCase,
    private readonly confirmBillingAuthUseCase: ConfirmBillingAuthUseCase,
    private readonly processDueAutoRenewalsUseCase: ProcessDueAutoRenewalsUseCase,
  ) {}

  @Get('subscriptions/me')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 구독 정보 조회' })
  @ApiOkResponse({
    description: '개인 워크스페이스의 구독 상태를 반환합니다.',
    type: MySubscriptionResponseDto,
  })
  getMySubscription(@Request() req: { user: AuthContext }) {
    return this.getMySubscriptionUseCase.execute(req.user.userId);
  }

  @Patch('subscriptions/me')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '내 구독 자동갱신 변경' })
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

  @Post('subscriptions/me/billing-auth/request')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: '토스페이먼츠 자동결제 인증 요청 정보 생성' })
  @ApiOkResponse({
    description:
      '프론트에서 requestBillingAuth 호출에 사용할 정보를 반환합니다.',
    type: BillingAuthRequestResponseDto,
  })
  createBillingAuthRequest(@Request() req: { user: AuthContext }) {
    return this.createBillingAuthRequestUseCase.execute(req.user.userId);
  }

  @Post('subscriptions/me/billing-auth/confirm')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({
    summary: '자동결제 빌링키 발급 및 최초 결제 승인',
    description:
      '먼저 POST /subscriptions/me/billing-auth/request로 customerKey를 발급받고, 프론트에서 토스페이먼츠 requestBillingAuth를 완료한 뒤 성공 리다이렉트의 authKey/customerKey로 호출합니다. Swagger 예시값만으로는 성공할 수 없습니다.',
  })
  @ApiBody({ type: ConfirmBillingAuthDto })
  @ApiOkResponse({
    description: '최초 결제 후 갱신된 구독 상태를 반환합니다.',
    type: MySubscriptionResponseDto,
  })
  confirmBillingAuth(
    @Request() req: { user: AuthContext },
    @Body() dto: ConfirmBillingAuthDto,
  ) {
    return this.confirmBillingAuthUseCase.execute(req.user.userId, dto);
  }

  @Post('subscriptions/auto-renewals/due')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '기한이 도래한 자동결제 처리' })
  @ApiHeader({
    name: 'x-auto-renewals-secret',
    required: true,
    description: '자동결제 배치 실행 시크릿',
  })
  @ApiOkResponse({
    description: '자동결제 처리 결과를 반환합니다.',
    type: ProcessDueAutoRenewalsResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      '자동결제 배치 실행이 비활성화되어 있거나 시크릿이 설정되지 않았습니다.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '자동결제 배치 실행 시크릿이 올바르지 않습니다.',
    type: ErrorResponseDto,
  })
  processDueAutoRenewals(@Request() request: ExpressRequest) {
    return this.processDueAutoRenewalsUseCase.execute({
      accessPolicy: {
        enabled:
          this.configService.get<string>('AUTO_RENEWALS_BATCH_ENABLED') ===
          'true',
        expectedSecret: this.configService.get<string>(
          'AUTO_RENEWALS_BATCH_SECRET',
        ),
        providedSecret: request.get('x-auto-renewals-secret'),
      },
    });
  }
}
