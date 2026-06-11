import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { AuthController } from './presentation/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GoogleStrategy } from './presentation/strategies/google.strategy';
import { GithubStrategy } from './presentation/strategies/github.strategy';
import { JwtRefreshGuard } from './presentation/guards/jwt-refresh-token.guard';
import { AUTH_REPOSITORY } from './domain/auth.repository';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { AUTH_SESSION_PORT } from './application/ports/auth-session.port';
import { SignInUseCase } from './application/usecases/sign-in.usecase';
import { LinkAccountUseCase } from './application/usecases/link-account.usecase';
import { SwitchUserUseCase } from './application/usecases/switch-user.usecase';
import { RefreshAccessTokenUseCase } from './application/usecases/refresh-access-token.usecase';
import { LogoutUseCase } from './application/usecases/logout.usecase';
import { JwtAuthSessionPort } from './infrastructure/jwt-auth-session.port';
import { TestAdminLoginUseCase } from './application/usecases/test-admin-login.usecase';

@Module({
  imports: [
    PrismaModule,
    // Passport 기반 OAuth 가드를 사용하기 위한 설정이다.
    PassportModule.register({ session: false }),
    // JwtService 제공만 받는다 (정책 없음)
    JwtModule.register({
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: AUTH_SESSION_PORT, useClass: JwtAuthSessionPort },
    SignInUseCase,
    LinkAccountUseCase,
    SwitchUserUseCase,
    RefreshAccessTokenUseCase,
    LogoutUseCase,
    TestAdminLoginUseCase,
    GoogleStrategy,
    GithubStrategy,
    JwtAccessGuard,
    JwtRefreshGuard,
  ],
})
export class AuthModule {}
