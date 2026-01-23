import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtAccessGuard } from './guards/jwt-access-token.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh-token.guard';

@Module({
  imports: [
    PrismaModule,
    // Passport 기반 OAuth 가드를 사용하기 위한 설정이다.
    PassportModule.register({ session: false }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET_KEY,
      // 토큰 유효기간 설정 (예: 15분)
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    GithubStrategy,
    JwtAccessGuard,
    JwtRefreshGuard,
  ],
  exports: [AuthService],
})
export class AuthModule {}
