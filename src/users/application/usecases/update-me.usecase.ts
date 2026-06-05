import { Inject, Injectable } from '@nestjs/common';
import { USERS_REPOSITORY } from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import { mapMeResponse } from '../policies/map-me-response.policy';
import { UsersError } from '../errors/users.error';
import {
  buildUpdateMeParams,
  resolveCurrentAuthAccount,
} from '../policies/update-me.policy';

export type UpdateMeInput = {
  displayName?: string | null;
  avatarUrl?: string | null;
};

@Injectable()
export class UpdateMeUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string, accountId: string, input: UpdateMeInput) {
    const user = await this.usersRepository.findUserWithAuthAccounts(userId);

    if (!user) {
      throw new UsersError('NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    resolveCurrentAuthAccount(user, accountId);
    const updateParams = buildUpdateMeParams(input);

    if (Object.keys(updateParams).length === 0) {
      return mapMeResponse(user, accountId);
    }

    const updatedAccount = await this.usersRepository.updateAuthAccountProfile(
      accountId,
      updateParams,
    );

    const mergedUser = {
      ...user,
      authAccounts: user.authAccounts.map((item) =>
        item.id === accountId ? updatedAccount : item,
      ),
    };

    return mapMeResponse(mergedUser, accountId);
  }
}
