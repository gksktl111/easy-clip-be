import { Inject, Injectable } from '@nestjs/common';
import { USERS_REPOSITORY } from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import { UsersError } from '../errors/users.error';

@Injectable()
export class DeleteMeUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.usersRepository.findUserById(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    const hasOwnedTeamWorkspace =
      await this.usersRepository.hasOwnedTeamWorkspace(userId);

    if (hasOwnedTeamWorkspace) {
      throw new UsersError(
        'BAD_REQUEST',
        '팀 워크스페이스 소유권을 이전한 뒤 탈퇴할 수 있습니다.',
      );
    }

    await this.usersRepository.deleteUserAndOwnedPersonalWorkspaces(userId);

    return {
      success: true,
    };
  }
}
