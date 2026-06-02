import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { UsersController } from './presentation/users.controller';
import { USERS_REPOSITORY } from './domain/users.repository';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { GetMeUseCase } from './application/usecases/get-me.usecase';
import { UpdateMeUseCase } from './application/usecases/update-me.usecase';
import { DeleteMeUseCase } from './application/usecases/delete-me.usecase';
import { GetUserSettingsUseCase } from './application/usecases/get-user-settings.usecase';
import { UpdateUserSettingsUseCase } from './application/usecases/update-user-settings.usecase';

@Module({
  controllers: [UsersController],
  providers: [
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    GetMeUseCase,
    UpdateMeUseCase,
    DeleteMeUseCase,
    GetUserSettingsUseCase,
    UpdateUserSettingsUseCase,
    JwtAccessGuard,
  ],
})
export class UsersModule {}
