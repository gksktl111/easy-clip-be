import { Module, Provider } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { UsersController } from './presentation/users.controller';
import { USERS_REPOSITORY, UsersRepository } from './domain/users.repository';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { GetMeUseCase } from './application/usecases/get-me.usecase';
import { UpdateMeUseCase } from './application/usecases/update-me.usecase';
import { DeleteMeUseCase } from './application/usecases/delete-me.usecase';
import { GetUserSettingsUseCase } from './application/usecases/get-user-settings.usecase';
import { UpdateUserSettingsUseCase } from './application/usecases/update-user-settings.usecase';

const userUseCases: Provider[] = [
  { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
  {
    provide: GetMeUseCase,
    useFactory: (repo: UsersRepository) => new GetMeUseCase(repo),
    inject: [USERS_REPOSITORY],
  },
  {
    provide: UpdateMeUseCase,
    useFactory: (repo: UsersRepository) => new UpdateMeUseCase(repo),
    inject: [USERS_REPOSITORY],
  },
  {
    provide: DeleteMeUseCase,
    useFactory: (repo: UsersRepository) => new DeleteMeUseCase(repo),
    inject: [USERS_REPOSITORY],
  },
  {
    provide: GetUserSettingsUseCase,
    useFactory: (repo: UsersRepository) => new GetUserSettingsUseCase(repo),
    inject: [USERS_REPOSITORY],
  },
  {
    provide: UpdateUserSettingsUseCase,
    useFactory: (repo: UsersRepository) => new UpdateUserSettingsUseCase(repo),
    inject: [USERS_REPOSITORY],
  },
];

@Module({
  controllers: [UsersController],
  providers: [...userUseCases, JwtAccessGuard],
})
export class UsersModule {}
