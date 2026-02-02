import { Module, Provider } from '@nestjs/common';
import { AuthController } from './presentation/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GoogleStrategy } from './presentation/strategies/google.strategy';
import { GithubStrategy } from './presentation/strategies/github.strategy';
import { JwtAccessGuard } from './presentation/guards/jwt-access-token.guard';
import { JwtRefreshGuard } from './presentation/guards/jwt-refresh-token.guard';
import { AUTH_REPOSITORY, AuthRepository } from './domain/auth.repository';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { SignInUseCase } from './application/usecases/sign-in.usecase';
import { LinkAccountUseCase } from './application/usecases/link-account.usecase';
import { SwitchUserUseCase } from './application/usecases/switch-user.usecase';
import { RefreshAccessTokenUseCase } from './application/usecases/refresh-access-token.usecase';
import { LogoutUseCase } from './application/usecases/logout.usecase';

const authUseCases: Provider[] = [
  { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
  {
    provide: SignInUseCase,
    useFactory: (repo: AuthRepository) => new SignInUseCase(repo),
    inject: [AUTH_REPOSITORY],
  },
  {
    provide: LinkAccountUseCase,
    useFactory: (repo: AuthRepository) => new LinkAccountUseCase(repo),
    inject: [AUTH_REPOSITORY],
  },
  {
    provide: SwitchUserUseCase,
    useFactory: (repo: AuthRepository) => new SwitchUserUseCase(repo),
    inject: [AUTH_REPOSITORY],
  },
  {
    provide: RefreshAccessTokenUseCase,
    useFactory: (repo: AuthRepository) => new RefreshAccessTokenUseCase(repo),
    inject: [AUTH_REPOSITORY],
  },
  {
    provide: LogoutUseCase,
    useFactory: (repo: AuthRepository) => new LogoutUseCase(repo),
    inject: [AUTH_REPOSITORY],
  },
];

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
    ...authUseCases,
    GoogleStrategy,
    GithubStrategy,
    JwtAccessGuard,
    JwtRefreshGuard,
  ],
})
export class AuthModule {}
