import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthContext } from 'src/common/types/auth-context.type';
import { AuthPlatform } from 'src/common/types/auth-platform.type';

type JwtClaims = {
  sub: string;
  accountId: string;
  platform: AuthPlatform;
};

@Injectable()
export class JwtRefreshGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Refresh token이 없습니다.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        audience: 'refresh',
        issuer: 'easy-clip',
      });

      const authContext: AuthContext = {
        userId: payload.sub,
        accountId: payload.accountId,
        platform: payload.platform,
      };

      request['user'] = authContext;
      request['refreshToken'] = token; // ⭐ 중요
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
