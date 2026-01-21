import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // Authorization 헤더에서 Bearer 토큰을 추출한다.
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('토큰이 없습니다.');
    }
    try {
      // 토큰을 검증하고 payload를 요청 객체에 주입한다.
      const payload = await this.jwtService.verifyAsync(token);

      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // Bearer 타입만 허용한다.
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
