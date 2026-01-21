import { Controller, Get, NotFoundException, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: { user: { sub: string } }) {
    const userId = String(req.user.sub);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authAccounts: true },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return {
      user: {
        id: user.id,
        displayName: user.displayName ?? null,
        avatarUrl: user.avatarUrl ?? null,
      },
      authAccounts: user.authAccounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerUserId: account.providerUserId,
        email: account.email ?? null,
      })),
    };
  }
}
