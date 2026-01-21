import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AuthService, type OAuthUser } from './auth.service';
import { SwitchAccountDto } from './dtos/switch-account.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  googleLogin(): void {
    // Passport가 Google 인증 페이지로 리다이렉트한다.
  }

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  googleCallback(@Request() req: { user: OAuthUser }) {
    // 전략에서 정규화한 사용자 정보를 기반으로 JWT를 발급한다.
    return this.authService.signInWithOAuth(req.user);
  }

  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  githubLogin(): void {
    // Passport가 GitHub 인증 페이지로 리다이렉트한다.
  }

  @Get('github/callback')
  @UseGuards(PassportAuthGuard('github'))
  githubCallback(@Request() req: { user: OAuthUser }) {
    // 전략에서 정규화한 사용자 정보를 기반으로 JWT를 발급한다.
    return this.authService.signInWithOAuth(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-user')
  switchUser(@Request() req, @Body() switchAccountDto: SwitchAccountDto) {
    // 토큰으로 인증된 사용자가 지정한 계정으로 JWT를 재발급한다.
    return this.authService.switchUser(
      String(req.user.sub),
      switchAccountDto.authAccountId,
    );
  }
}
