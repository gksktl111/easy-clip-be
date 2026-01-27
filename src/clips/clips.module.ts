import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';

@Module({
  controllers: [ClipsController],
  providers: [ClipsService, JwtAccessGuard],
})
export class ClipsModule {}
