import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SwitchUserDto } from './dtos/switch-user.dto';
import { JwtPayload, OAuthUser } from './auth';
import { JwtAccessGuard } from './guards/jwt-access-token.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh-token.guard';

interface OAuthRequest extends Request {
  user: OAuthUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    return this.authService.handleOAuthCallback(req.user);
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
    return this.authService.handleOAuthCallback(req.user);
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
    @Request() req: { user: JwtPayload },
    @Body() switchUserDto: SwitchUserDto,
  ) {
    return this.authService.switchUser(
      req.user.sub,
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
      user: JwtPayload;
      refreshToken: string;
    },
  ) {
    return this.authService.refreshAccessToken(req.user, req.refreshToken);
  }

  /**
   * 로그아웃 (현재 플랫폼 세션만)
   * POST /auth/logout
   */
  @UseGuards(JwtAccessGuard)
  @Post('logout')
  logout(@Request() req: { user: JwtPayload }) {
    return this.authService.logout(req.user.accountId, req.user.platform);
  }
}
