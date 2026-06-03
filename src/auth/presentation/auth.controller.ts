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
import { Request as ExpressRequest } from 'express';
import { JwtAccessGuard } from 'src/common/presentation/guards/jwt-access.guard';
import { AuthContext } from 'src/common/types/auth-context.type';
import { ApplicationExceptionFilter } from 'src/common/presentation/filters/application-exception.filter';
import { SwitchUserDto } from './dtos/switch-user.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh-token.guard';
import { SignInUseCase } from '../application/usecases/sign-in.usecase';
import { LinkAccountUseCase } from '../application/usecases/link-account.usecase';
import { SwitchUserUseCase } from '../application/usecases/switch-user.usecase';
import { RefreshAccessTokenUseCase } from '../application/usecases/refresh-access-token.usecase';
import { LogoutUseCase } from '../application/usecases/logout.usecase';
import { OAuthUser } from '../domain/auth.types';

interface OAuthRequest extends ExpressRequest {
  user: OAuthUser;
}

@Controller('auth')
@UseFilters(ApplicationExceptionFilter)
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

  /**
   * Google OAuth 로그인 시작
   * GET /auth/google
   */
  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  googleLogin(): void {
    // Passport가 Google 로그인 페이지로 리다이렉트
  }

  /**
   * Google OAuth 계정 연결 시작 (JWT 필요)
   * GET /auth/google/link
   */
  @Get('google/link')
  @UseGuards(JwtAccessGuard, PassportAuthGuard('google'))
  googleLink(): void {
    // JWT 인증 후 Google 로그인 페이지로 리다이렉트
  }

  /**
   * Google OAuth 콜백 (login / link 공통)
   * GET /auth/google/callback
   */
  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  googleCallback(@Request() req: OAuthRequest) {
    return this.handleOAuthCallback(req.user);
  }

  /* ======================================================
   * GitHub OAuth
   * ====================================================== */

  /**
   * GitHub OAuth 로그인 시작
   * GET /auth/github
   */
  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  githubLogin(): void {
    // Passport가 GitHub 로그인 페이지로 리다이렉트
  }

  /**
   * GitHub OAuth 계정 연결 시작 (JWT 필요)
   * GET /auth/github/link
   */
  @Get('github/link')
  @UseGuards(JwtAccessGuard, PassportAuthGuard('github'))
  githubLink(): void {
    // JWT 인증 후 GitHub 로그인 페이지로 리다이렉트
  }

  /**
   * GitHub OAuth 콜백 (login / link 공통)
   * GET /auth/github/callback
   */
  @Get('github/callback')
  @UseGuards(PassportAuthGuard('github'))
  githubCallback(@Request() req: OAuthRequest) {
    return this.handleOAuthCallback(req.user);
  }

  /* ======================================================
   * Account Switch
   * ====================================================== */

  /**
   * 연동된 계정 전환
   * POST /auth/switch-user
   */
  @UseGuards(JwtAccessGuard)
  @Post('switch-user')
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

  /**
   * Access Token 재발급
   * POST /auth/refresh
   */
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(
    @Request()
    req: {
      user: AuthContext;
      refreshToken: string;
    },
  ) {
    return this.refreshAccessTokenUseCase.execute(req.user, req.refreshToken);
  }

  /**
   * 로그아웃 (현재 플랫폼 세션만)
   * POST /auth/logout
   */
  @UseGuards(JwtAccessGuard)
  @Post('logout')
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
