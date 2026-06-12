import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import type { Response } from 'express';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/shared/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/shared/presentation/filters/application-exception.filter';
import { SwitchUserDto } from './dtos/switch-user.dto';
import {
  AuthSignInResponseDto,
  LogoutResponseDto,
  RefreshAccessTokenResponseDto,
} from './dtos/auth-response.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh-token.guard';
import { SignInUseCase } from '../application/usecases/sign-in.usecase';
import { LinkAccountUseCase } from '../application/usecases/link-account.usecase';
import { SwitchUserUseCase } from '../application/usecases/switch-user.usecase';
import { RefreshAccessTokenUseCase } from '../application/usecases/refresh-access-token.usecase';
import { LogoutUseCase } from '../application/usecases/logout.usecase';
import { TestAdminLoginUseCase } from '../application/usecases/test-admin-login.usecase';
import { OAuthUser } from '../domain/auth.types';
import { ErrorResponseDto } from 'src/shared/presentation/dtos/error-response.dto';
import { TestAdminLoginDto } from './dtos/test-admin-login.dto';
import {
  clearAuthCookies,
  resolveOAuthSuccessRedirectUrl,
  setAccessTokenCookie,
  setAuthCookies,
} from 'src/shared/presentation/helpers/auth-cookie.helper';

interface OAuthRequest extends ExpressRequest {
  user: OAuthUser;
}

@Controller('auth')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly signInUseCase: SignInUseCase,
    private readonly linkAccountUseCase: LinkAccountUseCase,
    private readonly switchUserUseCase: SwitchUserUseCase,
    private readonly refreshAccessTokenUseCase: RefreshAccessTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly testAdminLoginUseCase: TestAdminLoginUseCase,
  ) {}

  /* ======================================================
   * Google OAuth
   * ====================================================== */

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 로그인 시작' })
  @ApiOkResponse({
    description: 'OAuth 제공자 로그인 페이지로 리다이렉트됩니다.',
  })
  googleLogin(): void {}

  @Get('google/link')
  @UseGuards(JwtAccessGuard, PassportAuthGuard('google'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Google OAuth 계정 연결 시작' })
  @ApiOkResponse({
    description: '인증 후 OAuth 제공자 로그인 페이지로 리다이렉트됩니다.',
  })
  @ApiUnauthorizedResponse({
    description: '액세스 토큰이 없거나 유효하지 않습니다.',
    type: ErrorResponseDto,
  })
  googleLink(): void {}

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 콜백 처리' })
  @ApiFoundResponse({
    description:
      '로그인 또는 계정 연결 후 인증 쿠키를 저장하고 프론트엔드로 리다이렉트합니다.',
  })
  @ApiForbiddenResponse({
    description: '계정 연결 요청이 올바르지 않습니다.',
    type: ErrorResponseDto,
  })
  async googleCallback(
    @Request() req: OAuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.completeOAuthCallback(req.user, response);
  }

  /* ======================================================
   * GitHub OAuth
   * ====================================================== */

  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth 로그인 시작' })
  @ApiOkResponse({
    description: 'OAuth 제공자 로그인 페이지로 리다이렉트됩니다.',
  })
  githubLogin(): void {}

  @Get('github/link')
  @UseGuards(JwtAccessGuard, PassportAuthGuard('github'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'GitHub OAuth 계정 연결 시작' })
  @ApiOkResponse({
    description: '인증 후 OAuth 제공자 로그인 페이지로 리다이렉트됩니다.',
  })
  @ApiUnauthorizedResponse({
    description: '액세스 토큰이 없거나 유효하지 않습니다.',
    type: ErrorResponseDto,
  })
  githubLink(): void {}

  @Get('github/callback')
  @UseGuards(PassportAuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth 콜백 처리' })
  @ApiFoundResponse({
    description:
      '로그인 또는 계정 연결 후 인증 쿠키를 저장하고 프론트엔드로 리다이렉트합니다.',
  })
  @ApiForbiddenResponse({
    description: '계정 연결 요청이 올바르지 않습니다.',
    type: ErrorResponseDto,
  })
  async githubCallback(
    @Request() req: OAuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.completeOAuthCallback(req.user, response);
  }

  @Post('test/admin-login')
  @ApiOperation({ summary: '테스트용 관리자 로그인' })
  @ApiBody({ type: TestAdminLoginDto, required: false })
  @ApiOkResponse({
    description: '테스트 관리자 계정으로 토큰과 사용자 정보를 발급합니다.',
    type: AuthSignInResponseDto,
  })
  async testAdminLogin(
    @Body() dto: TestAdminLoginDto = {},
    @Res({ passthrough: true }) response: Response,
  ) {
    const authSession = await this.testAdminLoginUseCase.execute({
      email: 'admin@easyclip.local',
      displayName: 'Test Admin',
      avatarUrl: null,
      platform: dto.platform ?? 'WEB',
    });

    setAuthCookies(response, this.configService, authSession);

    return authSession;
  }

  /* ======================================================
   * Account Switch
   * ====================================================== */

  @UseGuards(JwtAccessGuard)
  @Post('switch-user')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '연동된 계정으로 전환' })
  @ApiBody({ type: SwitchUserDto })
  @ApiOkResponse({
    description: '선택한 계정 기준으로 새 토큰과 사용자 정보를 반환합니다.',
    type: AuthSignInResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '액세스 토큰이 없거나 유효하지 않습니다.',
    type: ErrorResponseDto,
  })
  async switchUser(
    @Request() req: { user: AuthContext },
    @Body() switchUserDto: SwitchUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const authSession = await this.switchUserUseCase.execute(
      req.user.userId,
      switchUserDto.authAccountId,
      req.user.platform,
    );

    setAuthCookies(response, this.configService, authSession);

    return authSession;
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '액세스 토큰 재발급' })
  @ApiOkResponse({
    description: '새 액세스 토큰을 반환합니다.',
    type: RefreshAccessTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '리프레시 토큰이 없거나 유효하지 않습니다.',
    type: ErrorResponseDto,
  })
  async refresh(
    @Request()
    req: {
      user: AuthContext;
      refreshToken: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.refreshAccessTokenUseCase.execute(
      req.user,
      req.refreshToken,
    );

    setAccessTokenCookie(response, this.configService, result.access_token);

    return result;
  }

  @UseGuards(JwtAccessGuard)
  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '현재 플랫폼 로그아웃' })
  @ApiOkResponse({
    description: '현재 플랫폼의 리프레시 토큰 세션을 만료시킵니다.',
    type: LogoutResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '액세스 토큰이 없거나 유효하지 않습니다.',
    type: ErrorResponseDto,
  })
  async logout(
    @Request() req: { user: AuthContext },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.logoutUseCase.execute(
      req.user.accountId,
      req.user.platform,
    );

    clearAuthCookies(response, this.configService);

    return result;
  }

  private handleOAuthCallback(oauthUser: OAuthUser) {
    if (oauthUser.mode === 'link') {
      return this.linkAccountUseCase.execute(oauthUser);
    }

    return this.signInUseCase.execute(oauthUser);
  }

  private async completeOAuthCallback(
    oauthUser: OAuthUser,
    response: Response,
  ): Promise<void> {
    const authSession = await this.handleOAuthCallback(oauthUser);

    setAuthCookies(response, this.configService, authSession);
    response.redirect(
      resolveOAuthSuccessRedirectUrl(this.configService, authSession.user.id),
    );
  }
}
