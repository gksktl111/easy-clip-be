import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthContext } from 'src/shared/types/auth-context.type';

@Injectable()
export class ClipUploadRateGuard implements CanActivate {
  private readonly windows = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: AuthContext }>();
    if (!req.is('multipart/form-data')) return true;
    const limit = Number(
      this.config.get<string>('CLIP_UPLOAD_REQUESTS_PER_MINUTE'),
    );
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'UPLOAD_RATE_LIMIT_NOT_CONFIGURED',
        message: '이미지 업로드 요청 제한 설정이 필요합니다.',
      });
    }
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) this.windows.delete(key);
    }
    const key = req.user.userId;
    let window = this.windows.get(key);
    if (!window) {
      // Bound bookkeeping without evicting an active user's quota.
      if (this.windows.size >= 10000)
        throw new ServiceUnavailableException(
          '이미지 업로드가 혼잡합니다. 잠시 후 다시 시도해주세요.',
        );
      window = { count: 0, expiresAt: now + 60000 };
      this.windows.set(key, window);
    }
    if (window.count >= limit) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', Math.ceil((window.expiresAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: 429,
          code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
          message: '이미지 업로드 요청이 너무 많습니다.',
        },
        429,
      );
    }
    window.count += 1;
    return true;
  }
}
