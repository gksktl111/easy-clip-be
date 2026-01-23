import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access-token.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, JwtAccessGuard],
  exports: [UsersService],
})
export class UsersModule {}
