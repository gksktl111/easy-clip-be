import { Module, Provider } from '@nestjs/common';
import { JwtAccessGuard } from 'src/auth/presentation/guards/jwt-access-token.guard';
import { GetMySubscriptionUseCase } from './application/usecases/get-my-subscription.usecase';
import { UpdateMySubscriptionUseCase } from './application/usecases/update-my-subscription.usecase';
import {
  WORKSPACES_REPOSITORY,
  WorkspacesRepository,
} from './domain/workspaces.repository';
import { PrismaWorkspacesRepository } from './infrastructure/prisma-workspaces.repository';
import { WorkspacesController } from './presentation/workspaces.controller';

const workspaceUseCases: Provider[] = [
  { provide: WORKSPACES_REPOSITORY, useClass: PrismaWorkspacesRepository },
  {
    provide: GetMySubscriptionUseCase,
    useFactory: (repo: WorkspacesRepository) =>
      new GetMySubscriptionUseCase(repo),
    inject: [WORKSPACES_REPOSITORY],
  },
  {
    provide: UpdateMySubscriptionUseCase,
    useFactory: (repo: WorkspacesRepository) =>
      new UpdateMySubscriptionUseCase(repo),
    inject: [WORKSPACES_REPOSITORY],
  },
];

@Module({
  controllers: [WorkspacesController],
  providers: [...workspaceUseCases, JwtAccessGuard],
})
export class WorkspacesModule {}
