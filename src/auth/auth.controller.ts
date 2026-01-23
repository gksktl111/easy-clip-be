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
import { SwitchAccountDto } from './dtos/switch-account.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthUser } from './auth';

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
  @UseGuards(JwtAuthGuard, PassportAuthGuard('google'))
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
  @UseGuards(JwtAuthGuard, PassportAuthGuard('github'))
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
  @UseGuards(JwtAuthGuard)
  @Post('switch-user')
  switchUser(
    @Request() req: { user: { sub: string } },
    @Body() switchAccountDto: SwitchAccountDto,
  ) {
    return this.authService.switchUser(
      req.user.sub,
      switchAccountDto.authAccountId,
    );
  }
}
