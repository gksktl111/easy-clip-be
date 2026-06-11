import { Module } from '@nestjs/common';
import { JwtAccessGuard } from 'src/shared/presentation/guards/jwt-access.guard';
import { GetMySubscriptionUseCase } from './application/usecases/get-my-subscription.usecase';
import { UpdateMySubscriptionUseCase } from './application/usecases/update-my-subscription.usecase';
import { WORKSPACES_REPOSITORY } from './domain/workspaces.repository';
import { PrismaWorkspacesRepository } from './infrastructure/prisma-workspaces.repository';
import { WorkspacesController } from './presentation/workspaces.controller';

@Module({
  controllers: [WorkspacesController],
  providers: [
    { provide: WORKSPACES_REPOSITORY, useClass: PrismaWorkspacesRepository },
    GetMySubscriptionUseCase,
    UpdateMySubscriptionUseCase,
    JwtAccessGuard,
  ],
})
export class WorkspacesModule {}
