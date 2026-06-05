import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/common/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
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
import { OAuthUser } from '../domain/auth.types';
import { ErrorResponseDto } from 'src/common/presentation/dtos/error-response.dto';

interface OAuthRequest extends ExpressRequest {
  user: OAuthUser;
}

@Controller('auth')
@UseFilters(ApplicationExceptionFilter)
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly signInUseCase: SignInUseCase,
    private readonly linkAccountUseCase: LinkAccountUseCase,
    private readonly switchUserUseCase: SwitchUserUseCase,
    private readonly refreshAccessTokenUseCase: RefreshAccessTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
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
  @ApiOkResponse({
    description: '로그인 또는 계정 연결 후 토큰과 사용자 정보를 반환합니다.',
    type: AuthSignInResponseDto,
  })
  @ApiForbiddenResponse({
    description: '계정 연결 요청이 올바르지 않습니다.',
    type: ErrorResponseDto,
  })
  googleCallback(@Request() req: OAuthRequest) {
    return this.handleOAuthCallback(req.user);
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
  @ApiOkResponse({
    description: '로그인 또는 계정 연결 후 토큰과 사용자 정보를 반환합니다.',
    type: AuthSignInResponseDto,
  })
  @ApiForbiddenResponse({
    description: '계정 연결 요청이 올바르지 않습니다.',
    type: ErrorResponseDto,
  })
  githubCallback(@Request() req: OAuthRequest) {
    return this.handleOAuthCallback(req.user);
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
  switchUser(
    @Request() req: { user: AuthContext },
    @Body() switchUserDto: SwitchUserDto,
  ) {
    return this.switchUserUseCase.execute(
      req.user.userId,
      switchUserDto.authAccountId,
      req.user.platform,
    );
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
  refresh(
    @Request()
    req: {
      user: AuthContext;
      refreshToken: string;
    },
  ) {
    return this.refreshAccessTokenUseCase.execute(req.user, req.refreshToken);
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
  logout(@Request() req: { user: AuthContext }) {
    return this.logoutUseCase.execute(req.user.accountId, req.user.platform);
  }

  private handleOAuthCallback(oauthUser: OAuthUser) {
    if (oauthUser.mode === 'link') {
      return this.linkAccountUseCase.execute(oauthUser);
    }

    return this.signInUseCase.execute(oauthUser);
  }
}
