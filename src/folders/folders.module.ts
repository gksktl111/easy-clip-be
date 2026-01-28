import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService, JwtAccessGuard],
})
export class FoldersModule {}
