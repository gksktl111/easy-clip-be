import { Inject, Injectable } from '@nestjs/common';
import {
  USERS_REPOSITORY,
  UpdateAuthAccountProfileParams,
} from '../../domain/users.repository';
import type { UsersRepository } from '../../domain/users.repository';
import { mapMeResponse } from '../policies/map-me-response.policy';
import { UsersError } from '../users.error';

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

    const currentAccount = user.authAccounts.find(
      (item) => item.id === accountId,
    );

    if (!currentAccount) {
      throw new UsersError('NOT_FOUND', '계정 정보를 찾을 수 없습니다.');
    }

    if (input.displayName === null) {
      throw new UsersError('BAD_REQUEST', 'displayName은 null일 수 없습니다.');
    }

    const updateParams = this.toUpdateParams(input);

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

  private toUpdateParams(input: UpdateMeInput): UpdateAuthAccountProfileParams {
    const params: UpdateAuthAccountProfileParams = {};

    if (input.displayName !== undefined && input.displayName !== null) {
      params.displayName = input.displayName;
    }

    if (input.avatarUrl !== undefined) {
      params.profileImageUrl = input.avatarUrl;
    }

    return params;
  }
}
