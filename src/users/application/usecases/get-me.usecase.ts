import { Inject, Injectable } from '@nestjs/common';
import { USERS_REPOSITORY } from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import { mapMeResponse } from '../policies/map-me-response.policy';
import { UsersError } from '../users.error';

@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string, accountId: string) {
    const user = await this.usersRepository.findUserWithAuthAccounts(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    return mapMeResponse(user, accountId);
  }
}
