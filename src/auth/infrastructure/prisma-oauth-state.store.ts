import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OAuthStateStore } from '../application/ports/oauth-state-store.port';

@Injectable()
export class PrismaOAuthStateStore implements OAuthStateStore {
  constructor(private readonly prisma: PrismaService) {}

  async issue(id: string, expiresAt: Date): Promise<void> {
    // Expired login attempts require no retention; the expiration index bounds cleanup.
    await this.prisma.oAuthStateNonce.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await this.prisma.oAuthStateNonce.create({ data: { id, expiresAt } });
  }

  async consume(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.oAuthStateNonce.deleteMany({
      where: { id, expiresAt: { gt: now } },
    });
    return result.count === 1;
  }
}
